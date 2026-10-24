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

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
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

const spacesSubViewRegistry = createTypedRegistry<string, SpacesSubViewRenderer>([], { name: "SpacesSubViewRegistry" });

export function registerSpacesSubView(viewKey: string, renderer: SpacesSubViewRenderer): void {
  spacesSubViewRegistry.register(viewKey, renderer);
}

export function overrideSpacesSubView(viewKey: string, renderer: SpacesSubViewRenderer): void {
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

export function createSpacesDescriptor(deps: SpacesDescriptorDeps = {}): BacDescriptor {
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
        const customRes = await customRenderer(context, { spaceService, isGuest, spaceParam });
        if (typeof customRes === "object" && customRes !== null && "contentHtml" in customRes) {
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
        const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
        const submittedId = first(context.request.query.submitted);
        const errorCode = first(context.request.query.error);
        const targetSpace = spaceParam
          ? (spaceService.getSpace(spaceParam) ?? spaceService.getSpaceByDomainOrSlug(spaceParam))
          : undefined;
        const errorMessages: Record<string, string> = {
          missing_reference: "Référence produit manquante : renseignez le champ SKU.",
          bad_type: "Type de produit invalide.",
          bad_price: "Prix invalide : montant positif attendu.",
          bad_stock: "Stock invalide : entier positif ou nul attendu.",
        };
        const bannerHtml = submittedId
          ? `<div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-medium">Proposition <strong>${escapeHtml(submittedId)}</strong> transmise à la modération du catalogue.</div>`
          : errorCode
            ? `<div class="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-medium">${escapeHtml(errorMessages[errorCode] ?? "Soumission refusée : vérifiez les champs.")}</div>`
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
        subViewHtml = await renderSpaceProfile(spaceService, spaceParam, isGuest);
      } else {
        // Standard view: public space directory (presentation fields only).
        const spaces = await spaceService.listSpacesAsync();
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        
        // Filter/search state from query params
        const rawQ = context.request.query.q;
        const rawCategory = context.request.query.category;
        const rawSort = context.request.query.sort;
        const searchQuery = typeof rawQ === "string" ? rawQ.toLowerCase().trim() : "";
        const categoryFilter = typeof rawCategory === "string" ? rawCategory : "all";
        const sortMode = typeof rawSort === "string" ? rawSort : "recent";
        
        // Compute filtered list
        let filtered = spaces;
        if (searchQuery) {
          filtered = filtered.filter((s) => 
            s.name.toLowerCase().includes(searchQuery) || 
            s.slug.toLowerCase().includes(searchQuery)
          );
        }
        if (categoryFilter !== "all") {
          filtered = filtered.filter((s) => s.category === categoryFilter);
        }
        
        // Sort
        if (sortMode === "recent") {
          filtered = [...filtered].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        } else if (sortMode === "alpha") {
          filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortMode === "popular") {
          filtered = [...filtered].sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0));
        }
        
        const categories = Array.from(new Set(spaces.map((s) => s.category)));
        
        subViewHtml = filtered.length === 0 ? `
          <div class="space-y-6">
            <!-- Hero Editorial -->
            <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-surface-container-low to-transparent border border-outline-variant/10 p-8 mb-8">
              <div class="relative z-10">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-3xl shadow-lg">📁</div>
                  <div>
                    <div class="flex items-center gap-2.5 flex-wrap">
                      <h1 class="text-2xl font-bold text-on-surface">Spaces Hub</h1>
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">${spaces.length} espace${spaces.length > 1 ? 's' : ''} actif${spaces.length > 1 ? 's' : ''}</span>
                    </div>
                    <p class="text-sm text-on-surface-variant mt-1">Découvrez les espaces, organisations et communautés</p>
                  </div>
                </div>
                <div class="flex items-center gap-6 text-sm flex-wrap">
                  <span class="flex items-center gap-2 text-on-surface-variant">
                    <strong class="text-on-surface font-bold text-base">${spaces.length}</strong> espace${spaces.length > 1 ? 's' : ''} au total
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Empty State -->
            <div class="glass-card p-12 rounded-2xl border border-outline-variant/15 text-center space-y-4">
              <div class="w-20 h-20 mx-auto rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center text-4xl">🔍</div>
              <div>
                <h2 class="text-lg font-bold text-on-surface mb-2">Aucun résultat trouvé</h2>
                <p class="text-sm text-on-surface-variant max-w-md mx-auto">
                  ${searchQuery ? `Aucun espace ne correspond à "<strong>${escapeHtml(searchQuery)}</strong>".` : "Aucun espace ne correspond à vos filtres."}
                </p>
              </div>
              ${(searchQuery || categoryFilter !== 'all') ? `
                <a href="/spaces?view=list" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-95 transition">
                  <span>🔄</span>
                  <span>Réinitialiser les filtres</span>
                </a>
              ` : ''}
            </div>
          </div>` : `
          <div class="space-y-6">
            <!-- Hero Editorial -->
            <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-surface-container-low to-transparent border border-outline-variant/10 p-8 mb-8">
              <div class="relative z-10">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-3xl shadow-lg">📁</div>
                  <div>
                    <h1 class="text-2xl font-bold text-on-surface">Spaces Hub</h1>
                    <p class="text-sm text-on-surface-variant mt-1">Découvrez les espaces, organisations et communautés</p>
                  </div>
                </div>
                <div class="flex items-center gap-6 text-sm flex-wrap">
                  <span class="flex items-center gap-2 text-on-surface-variant">
                    <strong class="text-on-surface font-bold text-base">${filtered.length}</strong> espace${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''}
                  </span>
                  <span class="text-on-surface-variant/40">•</span>
                  <span class="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span class="text-emerald-400">🛡️</span> 100% Espaces modérés
                  </span>
                  <span class="text-on-surface-variant/40">•</span>
                  <span class="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span class="text-amber-400">⚡</span> Données temps réel
                  </span>
                  ${searchQuery || categoryFilter !== 'all' ? `
                    <a href="/spaces?view=list" class="text-primary hover:underline font-medium text-xs ml-auto">🔄 Réinitialiser</a>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- Discovery Bar -->
            <div class="glass-card p-4 rounded-2xl border border-outline-variant/15 space-y-4">
              <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <!-- Search -->
                <div class="relative flex-1">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60">🔎</span>
                  <input
                    type="text"
                    value="${searchQuery}"
                    placeholder="Rechercher par nom, slug..."
                    class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition"
                    onchange="window.location.href=\`/spaces?view=list\${this.value ? \`&q=\${encodeURIComponent(this.value)}\` : ''}\${categoryFilter !== 'all' ? \`&category=\${encodeURIComponent(categoryFilter)}\` : ''}\${sortMode !== 'recent' ? \`&sort=\${sortMode}\` : ''}\`"
                  />
                </div>
                
                <!-- Filters -->
                <div class="flex gap-2 flex-wrap items-center">
                  <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant/70 mr-1 hidden lg:inline">Filtres:</span>
                  <select
                    class="px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer hover:border-primary/30 transition"
                    onchange="window.location.href=\`/spaces?view=list\${searchQuery ? \`&q=\${encodeURIComponent(searchQuery)}\` : ''}\${this.value !== 'all' ? \`&category=\${encodeURIComponent(this.value)}\` : ''}\${sortMode !== 'recent' ? \`&sort=\${sortMode}\` : ''}\`"
                  >
                    <option value="all"\${categoryFilter === 'all' ? ' selected' : ''}>Toutes catégories</option>
                    ${categories.map((c) => `<option value="${escapeHtml(c)}"\${categoryFilter === '${escapeHtml(c)}' ? ' selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join("")}
                  </select>
                  <select
                    class="px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer hover:border-primary/30 transition"
                    onchange="window.location.href=\`/spaces?view=list\${searchQuery ? \`&q=\${encodeURIComponent(searchQuery)}\` : ''}\${categoryFilter !== 'all' ? \`&category=\${encodeURIComponent(categoryFilter)}\` : ''}\${this.value !== 'recent' ? \`&sort=\${encodeURIComponent(this.value)}\` : ''}\`"
                  >
                    <option value="recent"\${sortMode === 'recent' ? ' selected' : ''}>📅 Récents</option>
                    <option value="alpha"\${sortMode === 'alpha' ? ' selected' : ''}>🔤 A-Z</option>
                    <option value="popular"\${sortMode === 'popular' ? ' selected' : ''}>⭐ Popularité</option>
                  </select>
                </div>
              </div>

              <!-- Category Pills Row with Counts -->
              <div class="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-outline-variant/10 text-xs">
                <a
                  href="/spaces?view=list${searchQuery ? `&amp;q=${encodeURIComponent(searchQuery)}` : ''}${sortMode !== 'recent' ? `&amp;sort=${sortMode}` : ''}"
                  class="px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${categoryFilter === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}"
                >
                  <span>Tous</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded-full ${categoryFilter === 'all' ? 'bg-white/20' : 'bg-surface-container-high'}">${spaces.length}</span>
                </a>
                ${categories.map((c) => {
                  const count = spaces.filter((s) => s.category === c).length;
                  const isActive = categoryFilter === c;
                  return `
                    <a
                      href="/spaces?view=list&amp;category=${encodeURIComponent(c)}${searchQuery ? `&amp;q=${encodeURIComponent(searchQuery)}` : ''}${sortMode !== 'recent' ? `&amp;sort=${sortMode}` : ''}"
                      class="px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${isActive ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}"
                    >
                      <span>${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))}</span>
                      <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20' : 'bg-surface-container-high'}">${count}</span>
                    </a>
                  `;
                }).join("")}
              </div>
            </div>

            <!-- Spaces Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              ${filtered.map((s) => {
                const pub = toPublicSpace(s);
                const isNew = (s.createdAt?.getTime() ?? 0) > oneWeekAgo;
                const accent = spaceAccent(s.template);
                const initials = pub.name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase();
                const capabilities = s.enabledCapabilities.slice(0, 3);
                return `
              <article class="group relative flex flex-col overflow-hidden rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:-translate-y-0.5 transition-all duration-300" style="border-top: 3px solid ${accent}; box-shadow: 0 0 0 0 transparent">
                <!-- Header band -->
                <div class="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-outline-variant/10" style="background: linear-gradient(90deg, ${accent}1f, transparent)">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border" style="background: ${accent}1a; color: ${accent}; border-color: ${accent}40">${escapeHtml(spaceTemplateLabel(s.template))}</span>
                  <div class="flex items-center gap-2">
                    ${isNew ? `<span class="px-2 py-0.5 rounded-md bg-primary/20 border border-primary/30 text-[10px] font-bold text-primary">Nouveau</span>` : ""}
                    <span class="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Actif</span>
                  </div>
                </div>
                <!-- Body -->
                <div class="p-4 flex-1 flex flex-col">
                  <div class="flex items-start gap-3 mb-3">
                    <div class="w-11 h-11 rounded-xl border-2 flex items-center justify-center text-sm font-black shadow-md group-hover:scale-105 transition-transform duration-300 shrink-0" style="background: ${accent}1a; color: ${accent}; border-color: ${accent}50">
                      ${escapeHtml(initials)}
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">${escapeHtml(pub.name)}</h3>
                      <p class="text-[11px] text-on-surface-variant/80 font-mono truncate">@${escapeHtml(pub.slug)}</p>
                    </div>
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container-high border border-outline-variant/20 text-on-surface-variant uppercase tracking-wider whitespace-nowrap">${escapeHtml(pub.category)}</span>
                  </div>
                  <p class="text-[11px] text-on-surface-variant leading-relaxed mb-3 line-clamp-2">Espace ${escapeHtml(pub.category)} — explorez ses activités publiques et ses offres.</p>
                  <!-- Capability chips -->
                  ${capabilities.length > 0 ? `<div class="flex flex-wrap gap-1.5 mb-3">${capabilities.map((cap) => `<span class="px-2 py-0.5 rounded bg-white/5 text-[10px] text-on-surface-variant border border-outline-variant/10 truncate max-w-full">${escapeHtml(cap.split(".").pop() ?? cap)}</span>`).join("")}</div>` : ""}
                  <div class="mt-auto flex items-center gap-4 text-[11px] text-on-surface-variant/80 font-medium pt-3 border-t border-outline-variant/10">
                    <span class="flex items-center gap-1.5" title="Abonnés"><strong class="text-on-surface font-bold tabular-nums">${pub.followersCount}</strong> abonnés</span>
                    <span class="flex items-center gap-1.5" title="Capacités actives"><strong class="text-on-surface font-bold tabular-nums">${s.enabledCapabilities.length}</strong> modules</span>
                  </div>
                </div>
                <!-- Footer actions -->
                <div class="px-4 pb-4 grid grid-cols-2 gap-2">
                  <a href="/spaces?view=profile&amp;space=${encodeURIComponent(pub.slug)}" class="text-center py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-[11px] font-bold transition">
                    Voir
                  </a>
                  <a href="/spaces?view=sell&amp;space=${encodeURIComponent(pub.slug)}" class="text-center py-2 rounded-xl text-[11px] font-bold border transition" style="background: ${accent}1a; color: ${accent}; border-color: ${accent}40">
                    Visiter
                  </a>
                </div>
              </article>`;
              }).join("")}
            </div>
          </div>
        `;
      }

      const contentHtml = `
        <div class="space-y-6">
          <!-- Subnavigation Bar -->
          <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">📁</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Spaces Hub</h1>
                <p class="text-[11px] text-on-surface-variant">Découverte des espaces et de leurs activités publiques</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/spaces?view=list" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'list' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Espaces
              </a>
              <a href="/spaces?view=profile${spaceParam ? `&amp;space=${encodeURIComponent(String(spaceParam))}` : ""}" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'profile' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Profil de l'Espace
              </a>
              ${isGuest ? "" : `
              <a href="/spaces?view=sell" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'sell' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Mettre en Vente
              </a>
              <a href="/spaces?view=new" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'new' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Créer un Espace
              </a>`}
            </div>
          </div>

          <!-- Main Subview content -->
          ${subViewHtml}

        </div>
      `;

      return {
        contentHtml,
        pageTitle: `Spaces — ${view === 'profile' ? "Profil de l'Espace" : view === 'sell' ? "Mettre en vente" : 'Espaces'}`,
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
  const directory = isGuest ? "" : `
              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                <div class="flex justify-between items-center">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Annuaire des Membres</h3>
                  <span class="text-[10px] text-primary font-bold font-mono tabular-nums">${space.team.length} actifs</span>
                </div>
                <div class="space-y-3 pt-1">
                  ${space.team.map((m) => `
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/15 flex items-center justify-center text-sm shadow-inner shrink-0">👤</div>
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-semibold text-on-surface truncate">${escapeHtml(m.userId)}</h4>
                        <p class="text-[10px] text-on-surface-variant truncate">${escapeHtml(m.role)}</p>
                      </div>
                    </div>`).join("")}
                </div>
              </div>`;
  const management = isGuest ? "" : `
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
