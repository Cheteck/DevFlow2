import { createTypedRegistry } from "@mosaix/support";
/**
 * @apps/spaces — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Spaces & Multi-tenancy.
 *
 * Data doctrine: spaces come from the injected SpaceService (Postgres in
 * production). No static spaces, members or stats — empty stores render
 * explicit empty states, never fabricated organizations.
 *
 * Visibility doctrine (guest policy): the public profile shows presentation
 * fields only (name, slug, category, followers). The member directory
 * (names + space roles, NEVER emails), management actions and invitations
 * are members-only. Space creation (`new`) requires a session (guarded).
 */

import type {
  BacDescriptor,
  BacExecutionContext,
  BacRenderResult,
} from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { SpaceService, type Space } from "../domain/space.model.js";

export interface SpacesDescriptorDeps {
  spaceService?: SpaceService;
}

/** Presentation-only fields safe for anonymous visitors. */
export interface PublicSpace {
  id: string;
  name: string;
  slug: string;
  category: string;
  followersCount: number;
}

export type SpacesSubViewRenderer = (
  context: BacExecutionContext,
  deps: { spaceService: SpaceService; isGuest: boolean; spaceParam?: string },
) => Promise<string | BacRenderResult> | string | BacRenderResult;

const spacesSubViewRegistry = createTypedRegistry<
  string,
  SpacesSubViewRenderer
>([], { name: "SpacesSubViewRegistry" });

export function registerSpacesSubView(
  viewKey: string,
  renderer: SpacesSubViewRenderer,
): void {
  spacesSubViewRegistry.register(viewKey, renderer);
}

export function overrideSpacesSubView(
  viewKey: string,
  renderer: SpacesSubViewRenderer,
): void {
  spacesSubViewRegistry.override(viewKey, renderer);
}

export function toPublicSpace(space: Space): PublicSpace {
  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    category: space.category,
    followersCount: space.followersCount ?? 0,
  };
}

/** Accent color per space template — presentation only, real data. */
const SPACE_TEMPLATE_ACCENTS: Record<string, string> = {
  business: "#8b5cf6",
  store: "#f59e0b",
  creator: "#ec4899",
  education: "#3b82f6",
  organization: "#10b981",
  project: "#06b6d4",
  community: "#f43f5e",
  custom: "#64748b",
};

function spaceAccent(template: string): string {
  return SPACE_TEMPLATE_ACCENTS[template] ?? "#64748b";
}

function spaceTemplateLabel(template: string): string {
  const labels: Record<string, string> = {
    business: "Business",
    store: "Boutique",
    creator: "Créateur",
    education: "Éducation",
    organization: "Organisation",
    project: "Projet",
    community: "Communauté",
    custom: "Sur mesure",
  };
  return labels[template] ?? "Espace";
}

export function createSpacesDescriptor(
  deps: SpacesDescriptorDeps = {},
): BacDescriptor {
  const spaceService = deps.spaceService ?? new SpaceService();

  return {
    id: "@apps/spaces",
    name: "Spaces Hub",
    version: "1.1.0",
    routePrefix: "/spaces",
    icon: "📁",
    isEnabled: true,
    requiredPermissions: ["spaces:space:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const rawView = context.request.query.view;
      const view = (Array.isArray(rawView) ? rawView[0] : rawView) || "list";
      const rawSpace = context.request.query.space;
      const spaceParam = Array.isArray(rawSpace) ? rawSpace[0] : rawSpace;
      // Guest boundary: anonymous execution contexts carry no roles (see
      // `src/start.ts`). Creation is session-only; the SSR guard redirects
      // guests to login and this is the second lock.
      const isGuest = (context.user.roles?.length ?? 0) === 0;

      // Check registered custom subview handlers (OCP extension)
      const customRenderer = spacesSubViewRegistry.get(view);
      if (customRenderer) {
        const customRes = await customRenderer(context, {
          spaceService,
          isGuest,
          spaceParam,
        });
        if (
          typeof customRes === "object" &&
          customRes !== null &&
          "contentHtml" in customRes
        ) {
          return customRes;
        }
        return {
          contentHtml: String(customRes),
          pageTitle: `Spaces — ${view}`,
        };
      }

      let subViewHtml: string;
      if (view === "sell") {
        if (isGuest) {
          return guestLoginPrompt(
            "Mettre en vente un produit",
            "La soumission d'une offre commerciale nécessite un compte marchand dans cet espace.",
          );
        }
        const first = (v: string | string[] | undefined) =>
          Array.isArray(v) ? v[0] : v;
        const submittedId = first(context.request.query.submitted);
        const errorCode = first(context.request.query.error);
        const targetSpace = spaceParam
          ? (spaceService.getSpace(spaceParam) ??
            spaceService.getSpaceByDomainOrSlug(spaceParam))
          : undefined;
        const errorMessages: Record<string, string> = {
          missing_reference:
            "Référence produit manquante : renseignez le champ SKU.",
          bad_type: "Type de produit invalide.",
          bad_price: "Prix invalide : montant positif attendu.",
          bad_stock: "Stock invalide : entier positif ou nul attendu.",
        };
        const bannerHtml = submittedId
          ? `<div class="success-container text-xs font-medium">Proposition <strong>${escapeHtml(submittedId)}</strong> transmise à la modération du catalogue.</div>`
          : errorCode
            ? `<div class="error-container text-xs font-medium">${escapeHtml(errorMessages[errorCode] ?? "Soumission refusée : vérifiez les champs.")}</div>`
            : "";
        if (!targetSpace) {
          const options = spaceService
            .listSpaces()
            .map(
              (s) =>
                `<a href="/spaces?view=sell&amp;space=${encodeURIComponent(s.id)}" class="block px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-xs font-bold text-on-surface transition">${escapeHtml(s.name)}</a>`,
            )
            .join("");
          subViewHtml = `
          <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 max-w-xl mx-auto space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Mettre un produit en vente (SELL-FLOW-02)</h3>
            <p class="text-[11px] text-on-surface-variant leading-relaxed">Choisissez l'espace marchand pour lequel soumettre la proposition.</p>
            <div class="space-y-2">${options || '<p class="text-[11px] text-on-surface-variant">Aucun espace pour le moment.</p>'}</div>
          </div>
        `;
        } else {
          subViewHtml = `
          <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 max-w-xl mx-auto space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Mettre un produit en vente (SELL-FLOW-02) — ${escapeHtml(targetSpace.name)}</h3>
            <p class="text-[11px] text-on-surface-variant leading-relaxed">Soumettez une proposition de produit et ses conditions commerciales à la modération du catalogue.</p>
            ${bannerHtml}
            <form method="POST" action="/api/spaces/${encodeURIComponent(targetSpace.id)}/proposals" class="space-y-4 text-xs">
              <div>
                <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Désignation du produit</label>
                <input name="name" type="text" placeholder="Ex: Xiaomi 18 Pro Max 5G Ceramic Edition" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" required />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Référence suggérée (SKU)</label>
                <input name="reference" type="text" placeholder="Ex: REF-XIAOMI-18-CERAMIC" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" required />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Type</label>
                <select name="type" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition">
                  <option value="Product">Produit</option>
                  <option value="Service">Service</option>
                  <option value="DigitalProduct">Produit numérique</option>
                  <option value="Experience">Expérience</option>
                </select>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-1">
                  <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Prix proposé</label>
                  <input name="price" type="number" placeholder="450.00" step="0.01" min="0.01" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" required />
                </div>
                <div>
                  <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Devise</label>
                  <select name="currency" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition">
                    <option value="EUR">EUR (€)</option>
                    <option value="DZD">DZD (دج)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Allocation de stock</label>
                  <input name="stock" type="number" placeholder="10" step="1" min="0" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" />
                </div>
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <a href="/spaces" class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 font-bold">Annuler</a>
                <button type="submit" class="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold shadow-md shadow-primary/25 cursor-pointer">Soumettre pour approbation</button>
              </div>
            </form>
          </div>
        `;
        }
      } else if (view === "new") {
        if (isGuest) {
          return guestLoginPrompt(
            "Créer un espace",
            "La création d'un espace nécessite un compte.",
          );
        }
        subViewHtml = `
          <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 max-w-xl mx-auto space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Créer un Nouvel Espace</h3>
            <p class="text-[11px] text-on-surface-variant leading-relaxed">Les espaces vous permettent d'isoler vos catalogues de produits, vos membres, vos ventes et vos analyses.</p>
            <form id="create-space-form" class="space-y-4 text-xs">
              <div>
                <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Nom de l'espace / Organisation</label>
                <input type="text" placeholder="Ex: École Supérieure d'Informatique" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" required />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Code Unique / Identifiant URL</label>
                <input type="text" placeholder="Ex: esi-alger" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" required />
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <a href="/spaces" class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 font-bold">Annuler</a>
                <button type="submit" class="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold shadow-md shadow-primary/25 cursor-pointer">Créer l'Espace</button>
              </div>
            </form>
          </div>
        `;
      } else if (view === "profile") {
        subViewHtml = await renderSpaceProfile(
          spaceService,
          spaceParam,
          isGuest,
        );
      } else {
        // Standard view: public space directory with Bento Grid layout (presentation fields only).
        const spaces = await spaceService.listSpacesAsync();
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        // Filter/search state from query params
        const rawQ = context.request.query.q;
        const rawCategory = context.request.query.category;
        const rawSort = context.request.query.sort;
        const rawCreated = context.request.query.created;
        const searchQuery =
          typeof rawQ === "string" ? rawQ.toLowerCase().trim() : "";
        const categoryFilter =
          typeof rawCategory === "string" ? rawCategory : "all";
        const sortMode = typeof rawSort === "string" ? rawSort : "recent";
        const createdFilter =
          typeof rawCreated === "string" ? rawCreated : "any";

        // Compute filtered list
        let filtered = spaces;
        if (searchQuery) {
          filtered = filtered.filter(
            (s) =>
              s.name.toLowerCase().includes(searchQuery) ||
              s.slug.toLowerCase().includes(searchQuery),
          );
        }
        if (categoryFilter !== "all") {
          filtered = filtered.filter((s) => s.category === categoryFilter);
        }
        if (createdFilter === "7d") {
          filtered = filtered.filter(
            (s) =>
              (s.createdAt?.getTime() ?? 0) > now - 7 * 24 * 60 * 60 * 1000,
          );
        } else if (createdFilter === "30d") {
          filtered = filtered.filter(
            (s) =>
              (s.createdAt?.getTime() ?? 0) > now - 30 * 24 * 60 * 60 * 1000,
          );
        }

        // Sort
        if (sortMode === "recent") {
          filtered = [...filtered].sort(
            (a, b) =>
              (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
          );
        } else if (sortMode === "alpha") {
          filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortMode === "popular") {
          filtered = [...filtered].sort(
            (a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0),
          );
        }

        const categories = Array.from(new Set(spaces.map((s) => s.category)));

        // Build query string helper
        const buildHref = (params: Record<string, string>) => {
          const p = {
            q: searchQuery,
            category: categoryFilter,
            sort: sortMode,
            created: createdFilter,
            ...params,
          };
          const searchParams = new URLSearchParams();
          searchParams.set("view", "list");
          if (p.q) searchParams.set("q", p.q);
          if (p.category && p.category !== "all")
            searchParams.set("category", p.category);
          if (p.sort && p.sort !== "recent") searchParams.set("sort", p.sort);
          if (p.created && p.created !== "any")
            searchParams.set("created", p.created);
          return `/spaces?${searchParams.toString()}`;
        };

        // Renderers
        function renderBentoBase(
          s: Space,
          pub: PublicSpace,
          isNew: boolean,
          accent: string,
          initials: string,
          capabilities: string[],
          layout: string,
          content: string,
        ) {
          return `
              <article class="${layout} group rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-outline-variant/30 transition-all duration-300 flex flex-col justify-between overflow-hidden relative shadow-sm" style="border-top: 4px solid ${accent}">
                <div class="p-3 bg-gradient-to-r from-surface-container-high/50 to-transparent border-b border-outline-variant/10 flex items-center justify-between">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border" style="background: ${accent}1a; color: ${accent}; border-color: ${accent}40">${escapeHtml(spaceTemplateLabel(s.template))}</span>
                  ${isNew ? `<span class="px-2 py-0.5 rounded-md bg-primary/20 border border-primary/30 text-[10px] font-bold text-primary">Nouveau</span>` : ""}
                </div>
                ${content}
              </article>`;
        }

        function renderBentoSpotlight(
          s: Space,
          pub: PublicSpace,
          isNew: boolean,
          accent: string,
          initials: string,
          capabilities: string[],
        ) {
          return renderBentoBase(
            s,
            pub,
            isNew,
            accent,
            initials,
            capabilities,
            "md:col-span-2 md:row-span-2",
            `
                <div class="p-6 flex-1 flex flex-col justify-between">
                  <div class="flex items-start gap-4">
                    <div class="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shrink-0" style="background: ${accent}1a; color: ${accent}">${escapeHtml(initials)}</div>
                    <div>
                      <h3 class="text-xl font-black text-on-surface">${escapeHtml(pub.name)}</h3>
                      <p class="text-xs text-on-surface-variant font-mono">@${escapeHtml(pub.slug)}</p>
                    </div>
                  </div>
                  <p class="text-sm text-on-surface-variant my-4">Espace ${escapeHtml(pub.category)} — découvrez nos activités.</p>
                  <div class="flex items-center gap-4 text-xs font-bold pt-4 border-t border-outline-variant/10">
                    <span>${pub.followersCount} abonnés</span>
                    <span>${s.enabledCapabilities.length} modules</span>
                  </div>
                </div>
                <div class="p-4 bg-black/10 border-t border-outline-variant/10 flex gap-2">
                  <a href="/spaces?view=profile&amp;space=${encodeURIComponent(pub.slug)}" class="flex-1 py-2 text-center text-xs font-bold bg-surface-container rounded-xl">Voir</a>
                  <a href="/spaces?view=sell&amp;space=${encodeURIComponent(pub.slug)}" class="flex-1 py-2 text-center text-xs font-bold text-on-primary rounded-xl" style="background:${accent}">Visiter</a>
                </div>
            `,
          );
        }

        function renderBentoVertical(
          s: Space,
          pub: PublicSpace,
          isNew: boolean,
          accent: string,
          initials: string,
          capabilities: string[],
        ) {
          return renderBentoBase(
            s,
            pub,
            isNew,
            accent,
            initials,
            capabilities,
            "md:row-span-2",
            `
                <div class="p-4 flex-1 flex flex-col justify-between">
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg mb-3" style="background: ${accent}1a; color: ${accent}">${escapeHtml(initials)}</div>
                  <h3 class="font-bold text-sm text-on-surface">${escapeHtml(pub.name)}</h3>
                  <p class="text-xs text-on-surface-variant my-2">${escapeHtml(pub.category)}</p>
                  <a href="/spaces?view=profile&amp;space=${encodeURIComponent(pub.slug)}" class="w-full py-2 mt-4 text-center text-xs font-bold text-on-primary rounded-xl" style="background:${accent}">Visiter</a>
                </div>
            `,
          );
        }

        function renderBentoMedium(
          s: Space,
          pub: PublicSpace,
          isNew: boolean,
          accent: string,
          initials: string,
          capabilities: string[],
        ) {
          return renderBentoBase(
            s,
            pub,
            isNew,
            accent,
            initials,
            capabilities,
            "",
            `
                <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div class="flex items-start justify-between">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shadow-md ring-1 group-hover:scale-105 transition" style="background: ${accent}1a; color: ${accent}">${escapeHtml(initials)}</div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container-high border border-outline-variant/20 text-on-surface-variant uppercase tracking-wider">${escapeHtml(pub.category)}</span>
                  </div>
                  <div class="space-y-1">
                    <h3 class="font-bold text-sm text-on-surface group-hover:text-primary transition">${escapeHtml(pub.name)}</h3>
                    <p class="text-[11px] font-mono text-on-surface-variant truncate">@${escapeHtml(pub.slug)}</p>
                    ${
                      capabilities.length > 0
                        ? `<div class="flex flex-wrap gap-1 pt-1">${capabilities
                            .slice(0, 3)
                            .map(
                              (cap) =>
                                `<span class="px-2 py-0.5 rounded bg-white/5 text-[10px] text-on-surface-variant border border-outline-variant/10">${escapeHtml(cap.split(".").pop() ?? cap)}</span>`,
                            )
                            .join("")}</div>`
                        : ""
                    }
                  </div>
                  <div class="space-y-2.5 pt-2 border-t border-outline-variant/10">
                    <div class="flex items-center gap-1.5 text-[11px] text-on-surface-variant/80">
                      <span class="material-symbols-outlined text-xs">group</span>
                      <strong class="text-on-surface">${pub.followersCount}</strong> abonnés
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <a href="/spaces?view=profile&amp;space=${encodeURIComponent(pub.slug)}" class="py-1.5 text-center rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-[11px] font-bold transition">Profil</a>
                      <a href="/spaces?view=sell&amp;space=${encodeURIComponent(pub.slug)}" class="py-1.5 text-center rounded-lg text-[11px] font-bold border transition" style="background: ${accent}1a; color: ${accent}; border-color: ${accent}40">Visiter</a>
                    </div>
                  </div>
                </div>
            `,
          );
        }

        function renderBentoCompact(
          s: Space,
          pub: PublicSpace,
          isNew: boolean,
          accent: string,
          initials: string,
          _capabilities: string[],
        ) {
          return `
              <article class="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-outline-variant/30 transition-all duration-300 flex items-center justify-between">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0" style="background: ${accent}1a; color: ${accent}">${escapeHtml(initials)}</div>
                  <div class="min-w-0">
                    <h4 class="font-bold text-xs text-on-surface truncate">${escapeHtml(pub.name)}</h4>
                    <p class="text-[10px] text-on-surface-variant truncate">${pub.followersCount} abonnés</p>
                  </div>
                </div>
                <a href="/spaces?view=profile&amp;space=${encodeURIComponent(pub.slug)}" class="p-1.5 rounded-lg shrink-0 transition" style="background: ${accent}1a; color: ${accent}">
                  <span class="material-symbols-outlined text-xs">arrow_forward</span>
                </a>
              </article>`;
        }

        subViewHtml =
          filtered.length === 0
            ? `

          <div class="space-y-6">
            <!-- Hero Editorial -->
            <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-surface-container-low to-transparent border border-outline-variant/10 p-8 mb-8">
              <div class="relative z-10">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-3xl shadow-lg">
                    <span class="material-symbols-outlined">folder</span>
                  </div>
                  <div>
                    <div class="flex items-center gap-2.5 flex-wrap">
                      <h1 class="text-2xl font-bold text-on-surface">Spaces Hub</h1>
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">${spaces.length} espace${spaces.length > 1 ? "s" : ""} actif${spaces.length > 1 ? "s" : ""}</span>
                    </div>
                    <p class="text-sm text-on-surface-variant mt-1">Découvrez les espaces, organisations et communautés</p>
                  </div>
                </div>
                <div class="flex items-center gap-6 text-sm flex-wrap">
                  <span class="flex items-center gap-2 text-on-surface-variant">
                    <strong class="text-on-surface font-bold text-base">${spaces.length}</strong> espace${spaces.length > 1 ? "s" : ""} au total
                  </span>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div class="glass-card p-12 rounded-2xl border border-outline-variant/15 text-center space-y-4">
              <div class="w-20 h-20 mx-auto rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center text-4xl">
                <span class="material-symbols-outlined text-4xl">search_off</span>
              </div>
              <div>
                <h2 class="text-lg font-bold text-on-surface mb-2">Aucun résultat trouvé</h2>
                <p class="text-sm text-on-surface-variant max-w-md mx-auto">
                  ${searchQuery ? `Aucun espace ne correspond à "<strong>${escapeHtml(searchQuery)}</strong>".` : "Aucun espace ne correspond à vos filtres."}
                </p>
              </div>
              ${
                searchQuery ||
                categoryFilter !== "all" ||
                createdFilter !== "any"
                  ? `
                <a href="/spaces?view=list" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-95 transition">
                  <span class="material-symbols-outlined text-sm">refresh</span>
                  <span>Réinitialiser les filtres</span>
                </a>
              `
                  : ""
              }
            </div>
          </div>`
            : `
          <div class="w-full">
            <!-- Hero Editorial -->
            <div class="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/10 via-surface-container-low to-transparent border border-outline-variant/10 p-5 sm:p-6 lg:p-8 mb-6">
              <div class="absolute -right-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <div class="absolute right-1/4 -bottom-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div class="space-y-2 max-w-3xl">
                  <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-base">
                      <span class="material-symbols-outlined text-base">folder</span>
                    </div>
                    <div class="flex items-center gap-2.5 flex-wrap">
                      <h1 class="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight">Spaces Hub</h1>
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">${spaces.length} espace${spaces.length > 1 ? "s" : ""} actif${spaces.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <p class="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    Explorez les Spaces MosaïX : boutiques officielles certifiées, artisans locaux, créateurs d'équipements technologiques et collectifs digitaux.
                  </p>
                  <div class="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant pt-1">
                    <span class="flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-warning text-sm">bolt</span>
                      <span>+280 nouveaux produits</span>
                    </span>
                    <span class="text-on-surface-variant/40">•</span>
                    <span class="flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-success text-sm">verified</span>
                      <span>100% Espaces modérés</span>
                    </span>
                    <span class="text-on-surface-variant/40">•</span>
                    <span class="flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-primary text-sm">location_on</span>
                      <span>Hub Algérie &amp; International</span>
                    </span>
                  </div>
                </div>
                <!--<div class="flex items-center gap-2.5 flex-shrink-0">
                  <a href="/spaces?view=profile${spaceParam ? `&amp;space=${encodeURIComponent(String(spaceParam))}` : ""}" class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/20 text-xs font-semibold transition">
                    <span class="material-symbols-outlined text-xs">badge</span>
                    <span>Profil de l'Espace</span>
                  </a>
                  ${
                    !isGuest
                      ? `
                  <a href="/spaces?view=new" class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary shadow-lg shadow-primary/20 text-xs font-bold transition hover:scale-[1.02]">
                    <span class="material-symbols-outlined text-xs">add_circle</span>
                    <span>+ Créer mon Espace</span>
                  </a>
                  `
                      : ""
                  }
                </div>-->  
              </div>
              <!-- Quick Tabs Pills Row -->
              <div class="mt-5 pt-4 border-t border-outline-variant/10 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-1.5 bg-surface-container p-1 rounded-xl border border-outline-variant/10 text-xs">
                  <a href="${buildHref({ sort: "recent" })}" class="px-3 py-1.5 rounded-lg ${sortMode === "recent" ? "bg-primary text-on-primary font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"} transition text-xs flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[11px]">border_all</span>
                    <span>Tous les Espaces</span>
                  </a>
                  <a href="${buildHref({ sort: "popular" })}" class="px-3 py-1.5 rounded-lg ${sortMode === "popular" ? "bg-primary text-on-primary font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"} transition text-xs flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-warning text-[11px]">local_fire_department</span>
                    <span>Tendances</span>
                  </a>
                  <a href="${buildHref({ sort: "recent", created: "7d" })}" class="px-3 py-1.5 rounded-lg ${sortMode === "recent" && createdFilter === "7d" ? "bg-primary text-on-primary font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"} transition text-xs flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-brand-300 text-[11px]">auto_awesome</span>
                    <span>Nouveautés</span>
                  </a>
                </div>
                <div class="flex items-center gap-2 text-xs text-on-surface-variant">
                  <button type="button" onclick="const sheet = document.getElementById('spaces-mobile-filter-sheet'); if (sheet) { sheet.classList.remove('hidden'); sheet.classList.add('flex'); document.body.style.overflow = 'hidden'; }" class="lg:hidden inline-flex items-center gap-1.5 bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-xl text-primary font-bold cursor-pointer hover:bg-primary/20 transition">
                    <span class="material-symbols-outlined text-sm">tune</span>
                    <span>Filtres (${(categoryFilter !== "all" ? 1 : 0) + (createdFilter !== "any" ? 1 : 0) + (searchQuery ? 1 : 0)})</span>
                  </button>
                  <!--<span class="hidden sm:inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg text-primary font-medium">
                    <span class="material-symbols-outlined text-brand-400 text-sm">grid_view</span>
                    Vue Mosaïque Bento
                  </span>-->
                </div>
              </div>
            </div>

            <!-- Modular Hybrid Body: fluid main + fixed filter rail -->
            <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 lg:gap-6 items-start">
              <!-- LEFT MAIN COLUMN: Bento Grid (fluid) -->
              <div class="min-w-0 space-y-4 lg:space-y-6">
                <!-- Bento Grid Section -->
                <section aria-label="Mosaïque Bento des Espaces" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-[minmax(180px,auto)]">
              ${filtered
                .map((s, idx) => {
                  const pub = toPublicSpace(s);
                  const isNew = (s.createdAt?.getTime() ?? 0) > oneWeekAgo;
                  const accent = spaceAccent(s.template);
                  const initials = pub.name
                    .split(/\s+/)
                    .map((w) => w.charAt(0))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const capabilities = s.enabledCapabilities.slice(0, 3);
                  const isSpotlight = idx === 0;
                  const isVertical = idx === 1 && filtered.length > 1;
                  const isCompact = idx >= 2 && idx < 4;
                  return isSpotlight
                    ? renderBentoSpotlight(
                        s,
                        pub,
                        isNew,
                        accent,
                        initials,
                        capabilities,
                      )
                    : isVertical
                      ? renderBentoVertical(
                          s,
                          pub,
                          isNew,
                          accent,
                          initials,
                          capabilities,
                        )
                      : isCompact
                        ? renderBentoCompact(
                            s,
                            pub,
                            isNew,
                            accent,
                            initials,
                            capabilities,
                          )
                        : renderBentoMedium(
                            s,
                            pub,
                            isNew,
                            accent,
                            initials,
                            capabilities,
                          );
                })
                .join("")}
            </section>

            <!-- Bottom Pagination / Status Count -->
            <div class="pt-5 border-t border-outline-variant/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p class="text-xs text-on-surface-variant">
                Affichage en mosaïque dynamique de <span class="text-on-surface font-semibold">1</span> à <span class="text-on-surface font-semibold">${filtered.length}</span> espace${filtered.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
            <!-- RIGHT SIDEBAR: Faceted Filtering (fixed rail) -->
            <aside class="hidden lg:block min-w-0 lg:sticky lg:top-20 space-y-4">
            <div class="bg-surface-container border border-outline-variant/20 rounded-2xl p-5 shadow-xl space-y-5">
              <!-- Filter Header -->
              <div>
                <div class="flex items-center justify-between pb-3 border-b border-outline-variant/10">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-xs">
                      <span class="material-symbols-outlined text-xs">tune</span>
                    </div>
                    <div>
                      <h3 class="text-xs font-bold text-on-surface uppercase tracking-wider">Filtres de Recherche</h3>
                      <span class="text-[10px] text-on-surface-variant">Précisez vos critères</span>
                    </div>
                  </div>
                  <a href="/spaces?view=list" class="text-[11px] text-primary hover:opacity-80 font-medium transition flex items-center gap-1">
                    <span class="material-symbols-outlined text-[10px]">refresh</span>
                    <span>Réinitialiser</span>
                  </a>
                </div>
              </div>

              <!-- Quick Keyword Filter Input -->
              <div class="space-y-1.5">
                <label class="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block">Mot-clé ou @tag</label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-3 top-2.5 text-xs text-on-surface-variant/50 text-sm pointer-events-none">search</span>
                  <input
                    class="w-full bg-surface-container-low text-xs text-on-surface placeholder-on-surface-variant/40 pl-9 pr-3 py-2 rounded-xl border border-outline-variant/20 focus:outline-none focus:border-primary/60 transition"
                    placeholder="Ex: réparation, artisanat..."
                    type="text"
                    value="${escapeHtml(searchQuery)}"
                    onchange="window.location.href='/spaces?view=list&amp;q=' + encodeURIComponent(this.value)${categoryFilter !== "all" ? ` + '&amp;category=${encodeURIComponent(categoryFilter)}'` : ""}${sortMode !== "recent" ? ` + '&amp;sort=${encodeURIComponent(sortMode)}'` : ""}${createdFilter !== "any" ? ` + '&amp;created=${encodeURIComponent(createdFilter)}'` : ""}"
                  />
                </div>
              </div>

              <!-- Category Filter Pills -->
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <label class="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Catégorie</label>
                  <span class="text-[10px] text-primary font-medium">${categories.length} disponibles</span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <a
                    href="${buildHref({ category: "all", q: searchQuery, sort: sortMode, created: createdFilter })}"
                    class="w-full flex items-center justify-between px-3 py-2 rounded-xl ${categoryFilter === "all" ? "bg-primary/15 border border-primary/30 text-primary font-semibold" : "bg-surface-container-low hover:bg-surface-container hover:bg-white/[0.04] border border-outline-variant/10 text-on-surface-variant"} text-xs transition"
                  >
                    <span class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[10px] ${categoryFilter === "all" ? "text-primary" : "text-on-surface-variant/50"}">radio_button_checked</span>
                      <span>Toutes catégories</span>
                    </span>
                    <span class="text-[10px] ${categoryFilter === "all" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"} px-2 py-0.5 rounded-full font-bold">${spaces.length}</span>
                  </a>
                  ${categories
                    .map((c) => {
                      const count = spaces.filter(
                        (sp) => sp.category === c,
                      ).length;
                      const isActive = categoryFilter === c;
                      return `
                  <a
                    href="${buildHref({ category: c, q: searchQuery, sort: sortMode, created: createdFilter })}"
                    class="w-full flex items-center justify-between px-3 py-2 rounded-xl ${isActive ? "bg-primary/15 border border-primary/30 text-primary font-semibold" : "bg-surface-container-low hover:bg-surface-container hover:bg-white/[0.04] border border-outline-variant/10 text-on-surface-variant"} text-xs transition"
                  >
                    <span class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[10px] ${isActive ? "text-primary" : "text-on-surface-variant/50"}">circle</span>
                      <span>${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))}</span>
                    </span>
                    <span class="text-[10px] ${isActive ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"} px-2 py-0.5 rounded-full">${count}</span>
                  </a>`;
                    })
                    .join("")}
                </div>
              </div>

              <!-- Sort / Activity Frequency Selector -->
              <div class="space-y-2 pt-2 border-t border-outline-variant/10">
                <label class="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block">Tri &amp; Activité</label>
                <div class="space-y-2 text-xs">
                  <label class="flex items-center justify-between p-2 rounded-xl bg-surface-container-low hover:bg-surface-container hover:bg-white/[0.04] border border-outline-variant/10 cursor-pointer transition">
                    <span class="flex items-center gap-2 text-on-surface-variant">
                      <span class="material-symbols-outlined text-primary text-xs">schedule</span>
                      <span>Récents (7 jours)</span>
                    </span>
                    <input ${createdFilter === "7d" ? "checked" : ""} class="rounded border-white/20 bg-surface-container text-primary focus:ring-primary/30" type="radio" name="created-filter" onchange="window.location.href='${buildHref({ created: "7d", q: searchQuery, category: categoryFilter, sort: sortMode })}'" />
                  </label>
                  <label class="flex items-center justify-between p-2 rounded-xl bg-surface-container-low hover:bg-surface-container hover:bg-white/[0.04] border border-outline-variant/10 cursor-pointer transition">
                    <span class="flex items-center gap-2 text-on-surface-variant">
                      <span class="material-symbols-outlined text-primary text-xs">calendar_month</span>
                      <span>Ce mois (30 jours)</span>
                    </span>
                    <input ${createdFilter === "30d" ? "checked" : ""} class="rounded border-white/20 bg-surface-container text-primary focus:ring-primary/30" type="radio" name="created-filter" onchange="window.location.href='${buildHref({ created: "30d", q: searchQuery, category: categoryFilter, sort: sortMode })}'" />
                  </label>
                  <label class="flex items-center justify-between p-2 rounded-xl bg-surface-container-low hover:bg-surface-container hover:bg-white/[0.04] border border-outline-variant/10 cursor-pointer transition">
                    <span class="flex items-center gap-2 text-on-surface-variant">
                      <span class="material-symbols-outlined text-primary text-xs">all_inclusive</span>
                      <span>N'importe quand</span>
                    </span>
                    <input ${createdFilter === "any" ? "checked" : ""} class="rounded border-white/20 bg-surface-container text-primary focus:ring-primary/30" type="radio" name="created-filter" onchange="window.location.href='${buildHref({ created: "any", q: searchQuery, category: categoryFilter, sort: sortMode })}'" />
                  </label>
                </div>
              </div>

              <!-- Apply button -->
              <div class="pt-3 border-t border-outline-variant/10">
                <a href="${buildHref({ q: searchQuery, category: categoryFilter, sort: sortMode, created: createdFilter })}" class="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 shadow-lg shadow-primary/15 transition flex items-center justify-center gap-2">
                  <span class="material-symbols-outlined text-xs">check</span>
                  <span>Appliquer les Filtres (${filtered.length})</span>
                </a>
              </div>
            </div>

            <!-- Secondary Space Creation Card -->
            ${
              !isGuest
                ? `
            <div class="rounded-2xl bg-gradient-to-br from-surface-container to-surface-container-low border border-primary/20 p-4 shadow-lg space-y-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs border border-primary/30">
                  <span class="material-symbols-outlined text-sm">storefront</span>
                </div>
                <div>
                  <h4 class="text-xs font-bold text-on-surface">Vous êtes commerçant ?</h4>
                  <p class="text-[10px] text-on-surface-variant">Ouvrez votre Espace MosaïX gratuit</p>
                </div>
              </div>
              <p class="text-[11px] text-on-surface-variant leading-relaxed">
                Publiez vos catalogues, synchronisez vos stocks et vendez directement dans les 58 wilayas.
              </p>
              <a href="/spaces?view=new" class="w-full py-2 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-xs font-semibold text-primary transition text-center flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-[11px]">rocket_launch</span>
                <span>Démarrer un Espace</span>
              </a>
            </div>`
                : ""
            }
            </aside>
            <!-- END RIGHT SIDEBAR -->
          </div>
          <!-- END Modular Hybrid Body -->

          <!-- MOBILE FILTER SHEET (bottom sheet, visible <lg only) -->
          <div id="spaces-mobile-filter-sheet" class="lg:hidden fixed inset-0 z-[200] hidden" role="dialog" aria-modal="true" aria-label="Filtres de recherche">
            <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="const sheet = document.getElementById('spaces-mobile-filter-sheet'); if (sheet) { sheet.classList.add('hidden'); sheet.classList.remove('flex'); document.body.style.overflow = ''; }"></div>
            <div class="absolute bottom-0 inset-x-0 bg-surface-container border-t border-outline-variant/20 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto p-5 space-y-5">
              <div class="flex items-center justify-between pb-3 border-b border-outline-variant/10">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-xs">
                    <span class="material-symbols-outlined text-xs">tune</span>
                  </div>
                  <div>
                    <h3 class="text-xs font-bold text-on-surface uppercase tracking-wider">Filtres de Recherche</h3>
                    <span class="text-[10px] text-on-surface-variant">Précisez vos critères</span>
                  </div>
                </div>
                <button type="button" onclick="const sheet = document.getElementById('spaces-mobile-filter-sheet'); if (sheet) { sheet.classList.add('hidden'); sheet.classList.remove('flex'); document.body.style.overflow = ''; }" class="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition cursor-pointer" aria-label="Fermer les filtres">
                  <span class="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div class="space-y-1.5">
                <label class="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block">Mot-clé ou @tag</label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-3 top-2.5 text-xs text-on-surface-variant/50 text-sm pointer-events-none">search</span>
                  <input
                    class="w-full bg-surface-container-low text-xs text-on-surface placeholder-on-surface-variant/40 pl-9 pr-3 py-2 rounded-xl border border-outline-variant/20 focus:outline-none focus:border-primary/60 transition"
                    placeholder="Ex: réparation, artisanat..."
                    type="text"
                    value="${escapeHtml(searchQuery)}"
                    onchange="window.location.href='/spaces?view=list&amp;q=' + encodeURIComponent(this.value)${categoryFilter !== "all" ? ` + '&amp;category=${encodeURIComponent(categoryFilter)}'` : ""}${sortMode !== "recent" ? ` + '&amp;sort=${encodeURIComponent(sortMode)}'` : ""}${createdFilter !== "any" ? ` + '&amp;created=${encodeURIComponent(createdFilter)}'` : ""}"
                  />
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block">Catégorie</label>
                <div class="flex flex-wrap gap-1.5">
                  <a href="${buildHref({ category: "all", q: searchQuery, sort: sortMode, created: createdFilter })}" class="px-3 py-1.5 rounded-full text-xs font-bold border transition ${categoryFilter === "all" ? "bg-primary text-on-primary border-primary" : "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container"}">Toutes (${spaces.length})</a>
                  ${categories
                    .map((c) => {
                      const count = spaces.filter(
                        (sp) => sp.category === c,
                      ).length;
                      const isActive = categoryFilter === c;
                      return `<a href="${buildHref({ category: c, q: searchQuery, sort: sortMode, created: createdFilter })}" class="px-3 py-1.5 rounded-full text-xs font-bold border transition ${isActive ? "bg-primary text-on-primary border-primary" : "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container"}">${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))} (${count})</a>`;
                    })
                    .join("")}
                </div>
              </div>

              <div class="space-y-2 pt-2 border-t border-outline-variant/10">
                <label class="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block">Tri &amp; Activité</label>
                <div class="grid grid-cols-3 gap-2">
                  <a href="${buildHref({ created: "7d", q: searchQuery, category: categoryFilter, sort: sortMode })}" class="py-2 rounded-xl text-[11px] font-bold text-center border transition ${createdFilter === "7d" ? "bg-primary/15 text-primary border-primary/30" : "bg-surface-container-low text-on-surface-variant border-outline-variant/10"}">7 jours</a>
                  <a href="${buildHref({ created: "30d", q: searchQuery, category: categoryFilter, sort: sortMode })}" class="py-2 rounded-xl text-[11px] font-bold text-center border transition ${createdFilter === "30d" ? "bg-primary/15 text-primary border-primary/30" : "bg-surface-container-low text-on-surface-variant border-outline-variant/10"}">30 jours</a>
                  <a href="${buildHref({ created: "any", q: searchQuery, category: categoryFilter, sort: sortMode })}" class="py-2 rounded-xl text-[11px] font-bold text-center border transition ${createdFilter === "any" ? "bg-primary/15 text-primary border-primary/30" : "bg-surface-container-low text-on-surface-variant border-outline-variant/10"}">Tous</a>
                </div>
              </div>

              <div class="flex gap-2 pt-3 border-t border-outline-variant/10">
                <a href="/spaces?view=list" class="flex-1 py-2.5 rounded-xl border border-outline-variant/20 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition text-center">Réinitialiser</a>
                <a href="${buildHref({ q: searchQuery, category: categoryFilter, sort: sortMode, created: createdFilter })}" class="flex-[2] py-2.5 rounded-xl text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 shadow-lg shadow-primary/15 transition text-center">Appliquer (${filtered.length})</a>
              </div>
            </div>
          </div>
          <!-- END MOBILE FILTER SHEET -->
        </div>
        `;
      }

      const contentHtml = `
        <div class="space-y-6">
          <!-- Subnavigation Bar -->
          <!-- <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">📁</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Spaces Hub</h1>
                <p class="text-[11px] text-on-surface-variant">Découverte des espaces et de leurs activités publiques</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/spaces?view=list" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === "list" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15"}">
                Espaces
              </a>
              <a href="/spaces?view=profile${spaceParam ? `&amp;space=${encodeURIComponent(String(spaceParam))}` : ""}" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === "profile" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15"}">
                Profil de l'Espace
              </a>
              ${
                isGuest
                  ? ""
                  : `
              <a href="/spaces?view=sell" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === "sell" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15"}">
                Mettre en Vente
              </a>
              <a href="/spaces?view=new" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === "new" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15"}">
                Créer un Espace
              </a>`
              }
            </div>
          </div>-->

          <!-- Main Subview content -->
          ${subViewHtml}

        </div>
      `;

      return {
        contentHtml,
        pageTitle: `Spaces — ${view === "profile" ? "Profil de l'Espace" : view === "sell" ? "Mettre en vente" : "Espaces"}`,
      };
    },
  };
}

function guestLoginPrompt(title: string, message: string): BacRenderResult {
  return {
    contentHtml: `
      <div class="space-y-6">
        <div class="glass-card rounded-2xl p-8 text-center space-y-4">
          <div class="text-3xl">🔒</div>
          <h2 class="text-sm font-bold text-on-surface">${escapeHtml(title)}</h2>
          <p class="text-xs text-on-surface-variant">${escapeHtml(message)}</p>
          <a href="/login?next=%2Fspaces" class="inline-block px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">Se connecter</a>
        </div>
      </div>`,
    pageTitle: "Spaces — Connexion requise",
  };
}

async function renderSpaceProfile(
  spaceService: SpaceService,
  spaceParam: unknown,
  isGuest: boolean,
): Promise<string> {
  const spaces = await spaceService.listSpacesAsync();
  let space: Space | undefined;
  if (typeof spaceParam === "string" && spaceParam.length > 0) {
    space =
      spaces.find((s) => s.slug === spaceParam || s.id === spaceParam) ??
      (await spaceService.getSpaceAsync(spaceParam));
  }
  space ??= spaces[0];
  if (!space) {
    return `
      <div class="glass-card rounded-2xl p-8 text-center space-y-4">
        <div class="text-3xl">📁</div>
        <h3 class="text-sm font-bold text-on-surface">Aucun espace à afficher</h3>
        <p class="text-xs text-on-surface-variant">Les espaces créés par la communauté apparaîtront ici.</p>
      </div>`;
  }
  const pub = toPublicSpace(space);
  // Members directory is members-only and never exposes emails.
  const directory = isGuest
    ? ""
    : `
              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                <div class="flex justify-between items-center">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Annuaire des Membres</h3>
                  <span class="text-[10px] text-primary font-bold font-mono tabular-nums">${space.team.length} actifs</span>
                </div>
                <div class="space-y-3 pt-1">
                  ${space.team
                    .map(
                      (m) => `
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/15 flex items-center justify-center text-sm shadow-inner shrink-0">👤</div>
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-semibold text-on-surface truncate">${escapeHtml(m.userId)}</h4>
                        <p class="text-[10px] text-on-surface-variant truncate">${escapeHtml(m.role)}</p>
                      </div>
                    </div>`,
                    )
                    .join("")}
                </div>
              </div>`;
  const management = isGuest
    ? ""
    : `
              <div class="flex items-center gap-2 pb-1">
                <a href="/spaces?view=sell&amp;space=${encodeURIComponent(space.id)}" class="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
                  <span class="material-symbols-outlined text-sm">storefront</span>
                  <span>Mettre en vente</span>
                </a>
                <a href="/commerce?seller=${encodeURIComponent(space.id)}" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold transition hover:opacity-95 shadow-md shadow-primary/20 flex items-center gap-1.5 cursor-pointer">
                  <span class="material-symbols-outlined text-sm">visibility</span>
                  <span>Voir les offres</span>
                </a>
              </div>`;

  return `
          <div class="space-y-6">
            <div class="glass-card rounded-2xl border border-outline-variant/20 overflow-hidden bg-surface-container-low/40 relative">
              <div class="p-6 flex flex-col md:flex-row items-center md:items-end justify-between relative z-10 gap-4">
                <div class="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
                  <div class="w-24 h-24 rounded-2xl overflow-hidden border-4 border-surface bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary shadow-xl shrink-0">
                    📁
                  </div>
                  <div class="space-y-1 pb-1">
                    <h2 class="text-lg font-bold text-on-surface flex items-center justify-center md:justify-start gap-1.5">
                      <span>${escapeHtml(pub.name)}</span>
                    </h2>
                    <p class="text-xs text-on-surface-variant font-normal">Identifiant unique : <strong class="font-mono text-primary">@${escapeHtml(pub.slug)}</strong></p>
                    <p class="text-[10px] text-on-surface-variant/85 mt-0.5">${escapeHtml(pub.category)} · ${pub.followersCount} suiveurs</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 pb-1">
                  ${management}
                </div>
              </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div class="lg:col-span-8 space-y-6">
                <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">À propos de l'Espace</h3>
                  <p class="text-xs text-on-surface-variant leading-relaxed">Espace ${escapeHtml(pub.category)} — suivez ses offres et ses activités depuis la vitrine.</p>
                </div>
              </div>
              <div class="lg:col-span-4 space-y-6">
                ${directory}
              </div>
            </div>
          </div>`;
}
