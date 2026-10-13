import type {
  BacDescriptor,
  BacExecutionContext,
  BacRenderResult,
} from "@mosaix/contracts";
import { PortfolioService } from "../domain/portfolio-service.js";
import { InMemoryVendableRepository } from "../infrastructure/in-memory-vendable-repository.js";
import type { Vendable } from "../domain/vendable.js";

/* AUDIT-RESET a055b8e (2026-10-13) — AUCUNE PERTE DÉTECTÉE.
 * Le diff de a055b8e migre cette vue vers le PIM normalisé (identity.reference, content.fr.name,
 * search({name})→tableau), en cohérence avec les commits PIM antérieurs ; les imports existent
 * (infrastructure/in-memory-vendable-repository.ts, domain/vendable.ts). Fait partie du batch
 * "and 14 more" mais son contenu correspond au travail de session.
 * Vérification restante : search/findVendable + rendus dashboard/détail avant toute restauration. */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createPortfolioView(service?: PortfolioService) {
  const activeService = service || new PortfolioService(new InMemoryVendableRepository());

  return {
    async render(context: { query?: Record<string, string> }): Promise<BacRenderResult> {
      const view = context.query?.view || "dashboard";
      const searchQuery = context.query?.search || "";
      const selectedRef = context.query?.ref || "";

      let innerViewHtml: string;

      // Fetch real catalog vendables from PortfolioService
      let vendables: Vendable[] = [];
      try {
        vendables = await activeService.search({
          name: searchQuery || undefined,
          limit: 48,
          offset: 0,
        });
      } catch {
        vendables = [];
      }

      const totalCount = vendables.length;
      const publishedCount = vendables.filter((v) => v.identity.status === "Published").length;
      const draftCount = vendables.filter((v) => v.identity.status === "Draft").length;
      const archivedCount = vendables.filter((v) => v.identity.status === "Archived").length;

      if (view === "detail" && selectedRef) {
        let vendable: Vendable | undefined = vendables.find(
          (v) => v.identity.reference === selectedRef || v.identity.id === selectedRef
        );
        if (!vendable) {
          try {
            vendable = await activeService.findVendable(selectedRef);
          } catch {
            vendable = undefined;
          }
        }

        if (vendable) {
          const titleFr = vendable.content.fr?.name || vendable.identity.reference;
          const titleEn = vendable.content.en?.name || "";
          const descFr = vendable.content.fr?.description || "Aucune description renseignée.";
          const specs = vendable.characteristics?.specifications || {};

          innerViewHtml = `
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <a href="/portfolio?view=all" class="text-xs text-primary font-bold hover:underline">&larr; Retour au catalogue</a>
                <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  vendable.identity.status === 'Published' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }">${escapeHtml(vendable.identity.status)}</span>
              </div>

              <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-6">
                <div>
                  <h2 class="text-lg font-bold text-on-surface">${escapeHtml(titleFr)}</h2>
                  ${titleEn ? `<p class="text-xs text-on-surface-variant font-medium mt-0.5">${escapeHtml(titleEn)}</p>` : ''}
                  <p class="text-xs text-on-surface-variant font-mono mt-1">Réf / Code: <span class="text-primary font-bold">${escapeHtml(vendable.identity.reference)}</span> · Type: ${escapeHtml(vendable.identity.type)}</p>
                </div>

                <div class="p-4 rounded-xl bg-surface-container/60 border border-outline-variant/10 space-y-2">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Description PIM</h3>
                  <p class="text-xs text-on-surface leading-relaxed">${escapeHtml(descFr)}</p>
                </div>

                <div class="space-y-3">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Spécifications & Attributs EAV</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    ${Object.entries(specs).map(([k, v]) => `
                      <div class="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/10 flex justify-between items-center">
                        <span class="font-medium text-on-surface-variant capitalize">${escapeHtml(k)}</span>
                        <span class="font-bold text-on-surface">${escapeHtml(String(v))}</span>
                      </div>
                    `).join("")}
                    ${Object.keys(specs).length === 0 ? '<p class="text-xs text-on-surface-variant italic col-span-2">Aucun attribut EAV renseigné.</p>' : ''}
                  </div>
                </div>
              </div>
            </div>
          `;
        } else {
          innerViewHtml = `
            <div class="glass-card p-8 rounded-2xl border border-outline-variant/20 text-center space-y-4">
              <p class="text-xs text-rose-400 font-bold">Fiche introuvable pour la référence [${escapeHtml(selectedRef)}].</p>
              <a href="/portfolio?view=all" class="text-xs text-primary font-bold hover:underline">&larr; Retour au catalogue</a>
            </div>
          `;
        }
      } else if (view === "dashboard") {
        innerViewHtml = `
          <div class="space-y-6">
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
                        <td class="py-3 font-mono text-primary">${escapeHtml(v.identity.reference)}</td>
                        <td>${escapeHtml(v.content.fr?.name || v.content.en?.name || v.identity.reference)}</td>
                        <td><span class="px-2 py-0.5 rounded bg-surface-container text-[10px]">${escapeHtml(v.identity.type)}</span></td>
                        <td><span class="text-emerald-400 font-bold">${escapeHtml(v.identity.status)}</span></td>
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
        // All products view
        const rowsHtml = vendables.map((v) => `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
            <div class="space-y-3">
              <div class="flex justify-between items-start">
                <h3 class="text-xs font-bold text-on-surface">${escapeHtml(v.content.fr?.name || v.content.en?.name || v.identity.reference)}</h3>
                <span class="text-[10px] font-bold uppercase tracking-wider ${
                  v.identity.status === 'Published' ? 'text-emerald-400' :
                  v.identity.status === 'Draft' ? 'text-on-surface-variant/50' : 'text-amber-400'
                }">
                  ${escapeHtml(v.identity.status)}
                </span>
              </div>
              
              <div class="text-[10px] text-on-surface-variant/80 space-x-1.5 font-mono">
                <span>Réf: ${escapeHtml(v.identity.reference)}</span>
                <span>·</span>
                <span>Type: ${escapeHtml(v.identity.type)}</span>
              </div>

              <div class="text-[11px] text-on-surface-variant line-clamp-2">
                ${escapeHtml(v.content.fr?.description || v.content.en?.description || "Pas de description.")}
              </div>
            </div>

            <div class="pt-4 border-t border-outline-variant/10 flex items-center justify-between mt-4">
              <span class="text-xs font-mono tabular-nums font-bold text-primary">${escapeHtml(v.identity.reference)}</span>
              <a href="/portfolio?view=detail&ref=${encodeURIComponent(v.identity.reference)}" class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-[10px] font-bold text-on-surface">
                Voir Fiche
              </a>
            </div>
          </div>
        `).join("");

        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Catalogue des Vendables (${vendables.length} affichés)</h2>
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
              <a href="/portfolio?view=all" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'all' || view === 'detail' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
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

export function createPortfolioDescriptor(service?: PortfolioService): BacDescriptor {
  const view = createPortfolioView(service);
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
