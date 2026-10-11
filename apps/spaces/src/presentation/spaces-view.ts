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

export function toPublicSpace(space: Space): PublicSpace {
  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    category: space.category,
    followersCount: space.followersCount ?? 0,
  };
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

      let subViewHtml: string;
      if (view === "new") {
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
        subViewHtml = spaces.length === 0 ? `
          <div class="space-y-6">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Espaces de Travail</h2>
            <div class="glass-card rounded-2xl p-8 text-center space-y-4">
              <div class="text-3xl">📁</div>
              <h3 class="text-sm font-bold text-on-surface">Aucun espace pour le moment</h3>
              <p class="text-xs text-on-surface-variant">Les espaces créés par la communauté apparaîtront ici.</p>
            </div>
          </div>` : `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Espaces de Travail</h2>
              ${isGuest ? "" : `
              <a href="/spaces?view=new" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1 cursor-pointer">
                <span class="material-symbols-outlined text-sm">add_box</span>
                <span>Nouvel Espace</span>
              </a>`}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              ${spaces.map((s) => {
                const pub = toPublicSpace(s);
                return `
              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
                <div class="space-y-3">
                  <div>
                    <h3 class="text-xs font-bold text-on-surface mt-1">${escapeHtml(pub.name)}</h3>
                    <p class="text-[10px] text-on-surface-variant mt-0.5 font-mono">@${escapeHtml(pub.slug)}</p>
                    <span class="text-[11px] text-on-surface-variant mt-2 block font-mono tabular-nums"><strong class="text-on-surface font-bold font-sans">${pub.followersCount}</strong> suiveurs</span>
                  </div>
                </div>
                <div class="pt-4 mt-4 border-t border-outline-variant/10">
                  <a href="/spaces?view=profile&amp;space=${encodeURIComponent(pub.slug)}" class="block text-center w-full py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-[10px] font-bold transition cursor-pointer">
                    Voir le profil
                  </a>
                </div>
              </div>`;
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
        pageTitle: `Spaces — ${view === 'profile' ? "Profil de l'Espace" : 'Espaces'}`,
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
                <a href="/commerce?seller=${encodeURIComponent(space.id)}" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold transition hover:opacity-95 shadow-md shadow-primary/20 flex items-center gap-1.5 cursor-pointer">
                  <span class="material-symbols-outlined text-sm">storefront</span>
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
