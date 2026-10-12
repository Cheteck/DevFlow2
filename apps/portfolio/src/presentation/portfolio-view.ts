import type {
  BacDescriptor,
  BacExecutionContext,
  BacRenderResult,
} from "@mosaix/contracts";
import { portfolioService, type PortfolioService } from "../domain/portfolio-service.js";
import type { Vendable } from "../domain/vendable.model.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createPortfolioView(service: PortfolioService = portfolioService) {
  return {
    async render(context: { query?: Record<string, string> }): Promise<BacRenderResult> {
      const view = context.query?.view || "dashboard";
      const searchQuery = context.query?.search || "";

      let innerViewHtml: string;

      // Fetch real catalog vendables for rendering if service is available
      const activeService = service || portfolioService;
      let vendables: Vendable[] = [];
      let totalCount = 0;

      if (activeService && typeof activeService.search === "function") {
        try {
          const searchResult = await activeService.search({
            query: searchQuery,
            limit: 48,
            offset: 0,
          });
          vendables = searchResult.items || [];
          totalCount = searchResult.total || 0;
        } catch {
          vendables = [];
          totalCount = 0;
        }
      }

      const publishedCount = vendables.filter((v) => v.status === "Published").length;
      const draftCount = vendables.filter((v) => v.status === "Draft").length;
      const archivedCount = vendables.filter((v) => v.status === "Archived").length;

      if (view === "dashboard") {
        innerViewHtml = `
          <div class="space-y-6">
            <!-- Real KPI Summary Header -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Vendables</span>
                  <span class="text-xl font-extrabold text-on-surface tabular-nums">${totalCount}</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">📦</div>
              </div>

              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Publiés / Validés</span>
                  <span class="text-xl font-extrabold text-emerald-400 tabular-nums">${publishedCount}</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg">✅</div>
              </div>

              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Brouillons (Draft)</span>
                  <span class="text-xl font-extrabold text-amber-400 tabular-nums">${draftCount}</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-lg">⏳</div>
              </div>

              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Archivés</span>
                  <span class="text-xl font-extrabold text-on-surface-variant tabular-nums">${archivedCount}</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">📂</div>
              </div>
            </div>

            <!-- Real Quality & Completeness Panel -->
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Statut du Catalogue Réel (PRD-0011)</h3>
                <span class="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">${totalCount} fiches enregistrées</span>
              </div>
              <p class="text-xs text-on-surface-variant">Administration du catalogue central. Les fiches ci-dessus reflètent les données persistées en base.</p>
            </div>
          </div>
        `;
      } else if (view === "features") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Catalogue des Caractéristiques</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5">Configuration des groupes d'attributs et types de caractéristiques EAV</p>
              </div>
            </div>

            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-outline-variant/20 text-[10px] uppercase font-bold text-on-surface-variant">
                      <th class="pb-3">Réf Vendable</th>
                      <th class="pb-3">Intitulé</th>
                      <th class="pb-3">Type</th>
                      <th class="pb-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-outline-variant/10 text-on-surface font-semibold">
                    ${vendables.map((v) => `
                      <tr>
                        <td class="py-3 font-mono text-primary">${escapeHtml(v.code)}</td>
                        <td>${escapeHtml(v.title.fr || v.title.en || v.code)}</td>
                        <td><span class="px-2 py-0.5 rounded bg-surface-container text-[10px]">${escapeHtml(v.type)}</span></td>
                        <td><span class="text-emerald-400 font-bold">${escapeHtml(v.status)}</span></td>
                      </tr>
                    `).join("")}
                    ${vendables.length === 0 ? '<tr><td colspan="4" class="py-4 text-center text-on-surface-variant">Aucun vendable trouvé.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } else if (view === "categories") {
        innerViewHtml = `
          <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Arborescence des Catégories</h3>
            <p class="text-xs text-on-surface-variant">Visualisation de la taxonomie du catalogue.</p>
            <div class="space-y-2 text-xs font-semibold">
              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center gap-2">
                <span>📁</span>
                <span>Catalogue Général</span>
                <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">${totalCount} vendables</span>
              </div>
            </div>
          </div>
        `;
      } else if (view === "proposals") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Propositions d'Ajouts (Space → Portfolio Workflow)</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5">Validation des suggestions proposées par les marchands</p>
              </div>
            </div>

            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 text-center py-8">
              <p class="text-xs text-on-surface-variant">Aucune proposition en attente pour le moment.</p>
            </div>
          </div>
        `;
      } else if (view === "bulk") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Import & Export de Masse (Bulk CSV / JSON)</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5">Validation et transfert de données du catalogue</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider">Importation CSV / JSON</h4>
                <p class="text-[11px] text-on-surface-variant">Importez des vendables en masse via le parser backend.</p>
              </div>

              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider">Exportation Catalogue</h4>
                <p class="text-[11px] text-on-surface-variant">Exportez la base au format CSV ou JSON-LD.</p>
              </div>
            </div>
          </div>
        `;
      } else {
        // All products view (real database items)
        const rowsHtml = vendables.map((v) => `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
            <div class="space-y-3">
              <div class="flex justify-between items-start">
                <h3 class="text-xs font-bold text-on-surface">${escapeHtml(v.title.fr || v.title.en || v.code)}</h3>
                <span class="text-[10px] font-bold uppercase tracking-wider ${
                  v.status === 'Published' ? 'text-emerald-400' :
                  v.status === 'Draft' ? 'text-on-surface-variant/50' : 'text-amber-400'
                }">
                  ${escapeHtml(v.status)}
                </span>
              </div>
              
              <div class="text-[10px] text-on-surface-variant/80 space-x-1.5 font-mono">
                <span>Réf: ${escapeHtml(v.code)}</span>
                <span>·</span>
                <span>Type: ${escapeHtml(v.type)}</span>
              </div>

              <div class="text-[11px] text-on-surface-variant line-clamp-2">
                ${escapeHtml(v.description.fr || v.description.en || "Pas de description.")}
              </div>
            </div>

            <div class="pt-4 border-t border-outline-variant/10 flex items-center justify-between mt-4">
              <span class="text-xs font-mono tabular-nums font-bold text-primary">${escapeHtml(v.code)}</span>
              <a href="/portfolio/${encodeURIComponent(v.code)}" class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-[10px] font-bold text-on-surface">
                Voir Fiche
              </a>
            </div>
          </div>
        `).join("");

        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Catalogue des Vendables (${vendables.length} affichés / ${totalCount} au total)</h2>
              <form method="GET" action="/portfolio" class="flex items-center gap-2">
                <input type="hidden" name="view" value="all" />
                <input type="text" name="search" value="${escapeHtml(searchQuery)}" placeholder="Rechercher par référence, nom..." class="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/20 text-xs text-on-surface w-64" />
                <button type="submit" class="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs">Rechercher</button>
              </form>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              ${rowsHtml}
              ${vendables.length === 0 ? '<div class="col-span-full text-center py-8 text-xs text-on-surface-variant">Aucun vendable ne correspond à la recherche.</div>' : ''}
            </div>
          </div>
        `;
      }

      const contentHtml = `
        <div class="space-y-6">
          
          <!-- Subnavigation bar -->
          <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">🎨</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Portfolio Catalog (BAC Domain v2.0)</h1>
                <p class="text-[11px] text-on-surface-variant">Gestion de catalogue de vendables (CS-Cart EAV, Modèles de Variantes, Validation Qualité)</p>
              </div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <a href="/portfolio?view=dashboard" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'dashboard' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Dashboard
              </a>
              <a href="/portfolio?view=all" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Tous les Produits
              </a>
              <a href="/portfolio?view=features" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'features' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Caractéristiques EAV
              </a>
              <a href="/portfolio?view=categories" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'categories' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Catégories
              </a>
              <a href="/portfolio?view=proposals" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'proposals' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Propositions
              </a>
              <a href="/portfolio?view=bulk" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'bulk' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Import/Export
              </a>
            </div>
          </div>

          <!-- Subview Content -->
          ${innerViewHtml}

        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Portfolio — Gestion de Catalogue",
      };
    },
  };
}

/**
 * Shell-facing BAC descriptor (dynamic discovery by bac-orchestrator).
 * Maps the shell execution context onto the view renderer.
 */
export function createPortfolioDescriptor(): BacDescriptor {
  const view = createPortfolioView();
  return {
    id: "@apps/portfolio",
    name: "Portfolio & Product Information",
    version: "1.0.0",
    routePrefix: "/portfolio",
    icon: "🎨",
    isEnabled: true,
    requiredPermissions: ["portfolio:vendable:read:tenant"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      return view.render({ query: context.request.query });
    },
  };
}
