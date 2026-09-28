/**
 * @apps/portfolio — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Portfolio & Catalog (PRD-0011).
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";

export function createPortfolioDescriptor(): BacDescriptor {
  const PRODUCTS = [
    { id: "v-001", name: "Xiaomi 18 Pro Max 5G", ref: "XIAOMI-18-PM", type: "Product", status: "Published", price: "1249.00 €", stock: 12, features: { chipset: "Snapdragon 8 Elite", battery: "8500mAh", network: "5G (30 bands)" } },
    { id: "v-002", name: "Bague Amel Or Pur 18k", ref: "GOLD-AMEL-18K", type: "Product", status: "Published", price: "2450.00 €", stock: 2, features: { material: "Or Jaune 18 carats", stone: "Diamant GIA 0.5ct" } },
    { id: "v-003", name: "Cours Yoga Vinyasa", ref: "YOGA-VIN-01", type: "Service", status: "Draft", price: "25.00 €", stock: 25, features: { duration: "60 mins", level: "Tous Niveaux" } },
    { id: "v-004", name: "E-Book Économie Circulaire", ref: "EBK-ECO-CIRC", type: "DigitalProduct", status: "In Review", price: "12.99 €", stock: 999, features: { format: "PDF, EPUB", pages: "180" } }
  ];

  return {
    id: "@apps/portfolio",
    name: "Portfolio Catalog",
    version: "1.0.0",
    routePrefix: "/portfolio",
    icon: "🎨",
    isEnabled: true,
    requiredPermissions: ["portfolio:vendable:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const query = context.request.query || {};
      const view = query.view || "all";

      let innerViewHtml: string;

      if (view === "dashboard") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="glass-card p-4 rounded-xl border border-outline-variant/20 space-y-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total Vendables</span>
                <p class="text-xl font-bold font-mono text-primary">12,480</p>
                <span class="text-[10px] text-emerald-400 font-medium">+128 ce mois</span>
              </div>
              <div class="glass-card p-4 rounded-xl border border-outline-variant/20 space-y-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Publiés</span>
                <p class="text-xl font-bold font-mono text-emerald-400">11,890</p>
                <span class="text-[10px] text-on-surface-variant">Offres actives</span>
              </div>
              <div class="glass-card p-4 rounded-xl border border-outline-variant/20 space-y-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Propositions</span>
                <p class="text-xl font-bold font-mono text-amber-400">19</p>
                <span class="text-[10px] text-amber-400 font-medium">En attente de revue</span>
              </div>
              <div class="glass-card p-4 rounded-xl border border-outline-variant/20 space-y-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Score Qualité Moyen</span>
                <p class="text-xl font-bold font-mono text-primary">88%</p>
                <span class="text-[10px] text-on-surface-variant">Complétude des fiches</span>
              </div>
            </div>

            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Alertes de Qualité &amp; Traductions</h3>
              <div class="space-y-2 text-xs">
                <div class="p-3 bg-surface-container rounded-xl flex items-center justify-between">
                  <span>⚠️ 24 articles sans traduction arabe</span>
                  <a href="/portfolio?view=all" class="text-primary font-bold hover:underline text-[11px]">Consulter</a>
                </div>
                <div class="p-3 bg-surface-container rounded-xl flex items-center justify-between">
                  <span>📷 8 nouveaux produits sans image principale</span>
                  <a href="/portfolio?view=all" class="text-primary font-bold hover:underline text-[11px]">Consulter</a>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (view === "categories") {
        innerViewHtml = `
          <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Arborescence des Catégories</h3>
            
            <div class="space-y-2 text-xs font-semibold">
              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center gap-2">
                <span>📁</span>
                <span>Électronique &amp; High-Tech</span>
                <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">12 produits</span>
              </div>
              <div class="pl-6 space-y-2 border-l-2 border-outline-variant/25">
                <div class="p-3 bg-surface-container/60 rounded-xl flex items-center gap-2">
                  <span>📱</span>
                  <span>Smartphones &amp; Mobiles</span>
                  <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">4 produits</span>
                </div>
                <div class="p-3 bg-surface-container/60 rounded-xl flex items-center gap-2">
                  <span>💻</span>
                  <span>Ordinateurs &amp; Accessoires</span>
                  <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">8 produits</span>
                </div>
              </div>

              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center gap-2 mt-4">
                <span>📁</span>
                <span>Mode &amp; Joaillerie</span>
                <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">5 produits</span>
              </div>
              <div class="pl-6 space-y-2 border-l-2 border-outline-variant/25">
                <div class="p-3 bg-surface-container/60 rounded-xl flex items-center gap-2">
                  <span>💎</span>
                  <span>Bijoux en Or Pur</span>
                  <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">2 produits</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (view === "features") {
        innerViewHtml = `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Caractéristiques CS-Cart &amp; Features contrôlées</h3>
              <a href="/portfolio?view=groups" class="text-xs text-primary font-bold hover:underline">Voir les Groupes &rarr;</a>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-outline-variant/20 text-on-surface-variant font-bold uppercase text-[10px]">
                    <th class="py-2">Code</th>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Groupe</th>
                    <th>Filtrable</th>
                    <th>Variantes</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-outline-variant/10">
                  <tr>
                    <td class="py-2.5 font-mono text-primary font-bold">brand</td>
                    <td>Marque / Constructeur</td>
                    <td><span class="px-2 py-0.5 rounded bg-surface-container text-[10px]">Énumération (E)</span></td>
                    <td>Général</td>
                    <td><span class="text-emerald-400 font-bold">Oui</span></td>
                    <td>Apple, Xiaomi, Samsung</td>
                  </tr>
                  <tr>
                    <td class="py-2.5 font-mono text-primary font-bold">ram</td>
                    <td>Mémoire RAM</td>
                    <td><span class="px-2 py-0.5 rounded bg-surface-container text-[10px]">Sélection (S)</span></td>
                    <td>Performance</td>
                    <td><span class="text-emerald-400 font-bold">Oui</span></td>
                    <td>8GB, 12GB, 16GB, 24GB</td>
                  </tr>
                  <tr>
                    <td class="py-2.5 font-mono text-primary font-bold">battery</td>
                    <td>Capacité Batterie</td>
                    <td><span class="px-2 py-0.5 rounded bg-surface-container text-[10px]">Texte (T)</span></td>
                    <td>Spécifications</td>
                    <td><span>Non</span></td>
                    <td>Libre (ex: 8500mAh)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (view === "groups") {
        innerViewHtml = `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="glass-card p-4 rounded-xl border border-outline-variant/20 space-y-2">
              <h4 class="text-xs font-bold text-on-surface">📦 Physical &amp; Body</h4>
              <p class="text-[10px] text-on-surface-variant">Poids, dimensions, matériaux, résistance à eau/poussière.</p>
              <span class="text-[10px] font-mono text-primary font-bold">8 caractéristiques</span>
            </div>
            <div class="glass-card p-4 rounded-xl border border-outline-variant/20 space-y-2">
              <h4 class="text-xs font-bold text-on-surface">⚡ Performance &amp; Hardware</h4>
              <p class="text-[10px] text-on-surface-variant">Chipset, CPU, GPU, RAM, Stockage, Refroidissement.</p>
              <span class="text-[10px] font-mono text-primary font-bold">14 caractéristiques</span>
            </div>
            <div class="glass-card p-4 rounded-xl border border-outline-variant/20 space-y-2">
              <h4 class="text-xs font-bold text-on-surface">💎 Quality &amp; Jewelry</h4>
              <p class="text-[10px] text-on-surface-variant">Carats or, pureté pierre, certification GIA, alliages.</p>
              <span class="text-[10px] font-mono text-primary font-bold">6 caractéristiques</span>
            </div>
          </div>
        `;
      } else if (view === "proposals") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Propositions d'Ajouts (Workflow)</h3>
              <button onclick="alert('Formulaire de proposition rédigé !')" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs cursor-pointer">Nouvelle Proposition</button>
            </div>

            <div class="space-y-4">
              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                <div class="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h4 class="text-xs font-bold text-on-surface">Proposition #PROP-0019 : Xiaomi 18 Ultra Plus</h4>
                    <p class="text-[10px] text-on-surface-variant mt-0.5">Soumis par : Tech_Dealer_DZ · 24 sept. 2026</p>
                  </div>
                  <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Brouillon</span>
                </div>
                <p class="text-[11px] text-on-surface-variant leading-relaxed">Ajout d'une nouvelle variante de Xiaomi avec 1TB de stockage et coque en céramique polie.</p>
                <div class="pt-3 border-t border-outline-variant/10 flex justify-end gap-2 text-xs">
                  <button onclick="alert('Proposition rejetée')" class="px-3 py-1.5 rounded-lg hover:bg-surface-variant/40 text-rose-400 font-bold cursor-pointer">Rejeter</button>
                  <button onclick="alert('Proposition approuvée !')" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold cursor-pointer">Approuver</button>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (view === "new") {
        innerViewHtml = `
          <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-6 max-w-3xl">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Nouveau Vendable — Wizard (8 Étapes)</h3>
              <span class="text-[10px] font-mono text-primary font-bold">Étape 1 / 8</span>
            </div>

            <form onsubmit="event.preventDefault(); alert('Brouillon créé avec succès !');" class="space-y-4 text-xs">
              <div>
                <label class="block font-bold text-on-surface mb-1">Référence Unique *</label>
                <input type="text" placeholder="ex: XIAOMI-18-ULTRA" class="w-full p-2.5 bg-surface-container rounded-xl border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary" required />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block font-bold text-on-surface mb-1">Type de Vendable *</label>
                  <select class="w-full p-2.5 bg-surface-container rounded-xl border border-outline-variant/30 text-on-surface">
                    <option value="Product">Product (Physique)</option>
                    <option value="Service">Service</option>
                    <option value="DigitalProduct">DigitalProduct</option>
                    <option value="Experience">Experience</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-on-surface mb-1">Statut Initial</label>
                  <input type="text" value="Draft" disabled class="w-full p-2.5 bg-surface-container/50 rounded-xl border border-outline-variant/20 text-on-surface-variant font-bold" />
                </div>
              </div>
              <div>
                <label class="block font-bold text-on-surface mb-1">Nom (FR) *</label>
                <input type="text" placeholder="Nom du produit ou service" class="w-full p-2.5 bg-surface-container rounded-xl border border-outline-variant/30 text-on-surface" required />
              </div>
              <div class="pt-4 flex justify-end gap-2">
                <a href="/portfolio?view=all" class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold">Annuler</a>
                <button type="submit" class="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold">Suivant &rarr;</button>
              </div>
            </form>
          </div>
        `;
      } else if (view === "import" || view === "export") {
        innerViewHtml = `
          <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-4 max-w-xl">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">${view === 'import' ? 'Importation Massive (CSV / JSON)' : 'Exportation du Catalogue'}</h3>
            <p class="text-xs text-on-surface-variant">Conforme aux validations PortfolioService &amp; CS-Cart Features.</p>
            <div class="p-4 border-2 border-dashed border-outline-variant/30 rounded-xl text-center space-y-2">
              <span class="text-2xl">📄</span>
              <p class="text-xs font-bold text-on-surface">${view === 'import' ? 'Glissez-déposez un fichier CSV ou JSON' : 'Sélectionnez le format d'exportation'}</p>
              <button onclick="alert('Action d'import/export exécutée !')" class="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs cursor-pointer">${view === 'import' ? 'Parcourir les fichiers' : 'Télécharger CSV'}</button>
            </div>
          </div>
        `;
      } else {
        // All products view
        const rowsHtml = PRODUCTS.map(p => `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
            <div class="space-y-3">
              <div class="flex justify-between items-start">
                <h3 class="text-xs font-bold text-on-surface">${escapeHtml(p.name)}</h3>
                <span class="text-[10px] font-bold uppercase tracking-wider ${
                  p.status === 'Published' ? 'text-emerald-400' : 
                  p.status === 'Draft' ? 'text-on-surface-variant/50' : 'text-amber-400'
                }">
                  ${escapeHtml(p.status)}
                </span>
              </div>
              
              <div class="text-[10px] text-on-surface-variant/80 space-x-1.5 font-mono">
                <span>Réf: ${escapeHtml(p.ref)}</span>
                <span>·</span>
                <span>Type: ${escapeHtml(p.type)}</span>
                <span>·</span>
                <span>Stock: <strong class="tabular-nums">${p.stock}</strong></span>
              </div>

              <div class="mt-3 p-2.5 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/10 space-y-1">
                ${Object.entries(p.features).map(([k, v]) => `
                  <div class="flex justify-between text-[10px]">
                    <span class="capitalize text-on-surface-variant/80">${escapeHtml(k)} :</span>
                    <span class="font-bold text-on-surface">${escapeHtml(v)}</span>
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="pt-4 border-t border-outline-variant/10 flex items-center justify-between mt-4">
              <span class="text-xs font-mono tabular-nums font-bold text-primary">${escapeHtml(p.price)}</span>
              <a href="/portfolio?view=all&id=${p.id}" class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-[10px] font-bold text-on-surface">
                Éditer
              </a>
            </div>
          </div>
        `).join("");

        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Catalogue des Vendables</h2>
              <a href="/portfolio?view=new" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs">+ Nouveau Vendable</a>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              ${rowsHtml}
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
                <h1 class="text-sm font-bold text-on-surface">Portfolio Catalog</h1>
                <p class="text-[11px] text-on-surface-variant">Gestion de catalogue de vendables (EAV, caractéristiques CS-Cart, validation PRD-0011)</p>
              </div>
            </div>
            <div class="flex gap-1.5 flex-wrap">
              <a href="/portfolio?view=dashboard" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'dashboard' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Dashboard
              </a>
              <a href="/portfolio?view=all" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Vendables
              </a>
              <a href="/portfolio?view=categories" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'categories' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Catégories
              </a>
              <a href="/portfolio?view=features" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'features' || view === 'groups' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Features
              </a>
              <a href="/portfolio?view=proposals" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'proposals' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Propositions
              </a>
              <a href="/portfolio?view=import" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'import' || view === 'export' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
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
        pageTitle: "Portfolio — Gestion de Catalogue (PRD-0011)",
      };
    },
  };
}
