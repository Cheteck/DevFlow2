import { BacRenderResult } from "@mosaix/contracts";

interface SampleVendable {
  ref: string;
  name: string;
  type: "Product" | "Service" | "Subscription" | "DigitalAsset";
  price: string;
  stock: number;
  status: "Published" | "Draft" | "Archived" | "InReview";
  qualityScore: number;
  features: Record<string, string>;
  category: string;
}

const PRODUCTS: SampleVendable[] = [
  {
    ref: "VND-XIAOMI-18PRO",
    name: "Xiaomi 18 Pro Max 5G (8500mAh / 1TB)",
    type: "Product",
    price: "185 000 DZD",
    stock: 42,
    status: "Published",
    qualityScore: 95,
    category: "Smartphones & Mobiles",
    features: { marque: "Xiaomi", stockage: "1TB", ram: "24GB", batterie: "8500mAh", gsm30Bands: "Oui" }
  },
  {
    ref: "VND-SAMSUNG-S26",
    name: "Samsung Galaxy S26 Ultra 1TB Titanium",
    type: "Product",
    price: "240 000 DZD",
    stock: 15,
    status: "Published",
    qualityScore: 98,
    category: "Smartphones & Mobiles",
    features: { marque: "Samsung", ecran: "6.8 OLED 120Hz", camera: "200MP", stylet: "S-Pen" }
  },
  {
    ref: "VND-CAJ-CERAMIC",
    name: "Poudre de Céramique CAJ Jijel Pureté 99%",
    type: "Product",
    price: "4 500 DZD / kg",
    stock: 120,
    status: "Published",
    qualityScore: 88,
    category: "Artisanat / Matériaux",
    features: { origines: "Jijel Algérie", qualite: "Série A High-Grade", application: "Poterie / Revêtements" }
  },
  {
    ref: "VND-MACBOOK-M4",
    name: "Apple MacBook Pro 16 M4 Max 64GB",
    type: "Product",
    price: "480 000 DZD",
    stock: 5,
    status: "Draft",
    qualityScore: 72,
    category: "Ordinateurs & Accessoires",
    features: { marque: "Apple", processeur: "M4 Max", ram: "64GB Unified" }
  }
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createPortfolioView() {
  return {
    async render(context: { query?: Record<string, string> }): Promise<BacRenderResult> {
      const view = context.query?.view || "dashboard";

      let innerViewHtml: string;

      if (view === "dashboard") {
        innerViewHtml = `
          <div class="space-y-6">
            <!-- KPI Summary Header -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Vendables</span>
                  <span class="text-xl font-extrabold text-on-surface tabular-nums">12,480</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">📦</div>
              </div>

              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Publiés / Validés</span>
                  <span class="text-xl font-extrabold text-emerald-400 tabular-nums">11,920</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg">✅</div>
              </div>

              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Propositions en Attente</span>
                  <span class="text-xl font-extrabold text-amber-400 tabular-nums">48</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-lg">⏳</div>
              </div>

              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Score Qualité Moyen</span>
                  <span class="text-xl font-extrabold text-primary tabular-nums">91.4%</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">⭐</div>
              </div>
            </div>

            <!-- Quality & Completeness Alert Panel -->
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Indicateurs de Qualité du Catalogue (PRD-0011)</h3>
                <span class="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">142 fiches à compléter</span>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div class="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/10 space-y-1">
                  <div class="flex justify-between font-bold">
                    <span>Traductions Arabes Manquantes</span>
                    <span class="text-rose-400">86 articles</span>
                  </div>
                  <p class="text-[10px] text-on-surface-variant">Intitulés et descripteurs sans variante AR complète.</p>
                </div>

                <div class="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/10 space-y-1">
                  <div class="flex justify-between font-bold">
                    <span>Image Principale Manquante</span>
                    <span class="text-amber-400">34 articles</span>
                  </div>
                  <p class="text-[10px] text-on-surface-variant">Requiert au moins un média principal avec balise alt.</p>
                </div>

                <div class="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/10 space-y-1">
                  <div class="flex justify-between font-bold">
                    <span>Caractéristiques EAV Non Renseignées</span>
                    <span class="text-primary">22 articles</span>
                  </div>
                  <p class="text-[10px] text-on-surface-variant">Attributs requis par la catégorie absents.</p>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (view === "features") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Catalogue des Caractéristiques (CS-Cart EAV Engine)</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5">Configuration des groupes d'attributs, types de caractéristiques et filtres facettés</p>
              </div>
              <button onclick="alert('Formulaire de nouvelle caractéristique prêt !')" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs cursor-pointer">+ Créer Caractéristique</button>
            </div>

            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-outline-variant/20 text-[10px] uppercase font-bold text-on-surface-variant">
                      <th class="pb-3">Code / Nom</th>
                      <th class="pb-3">Groupe EAV</th>
                      <th class="pb-3">Type</th>
                      <th class="pb-3">Usage Metier</th>
                      <th class="pb-3">Filtre Facetté</th>
                      <th class="pb-3 text-right">Variantes</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-outline-variant/10 text-on-surface font-semibold">
                    <tr>
                      <td class="py-3">
                        <span class="font-bold block">gsm_5g_bands</span>
                        <span class="text-[10px] text-on-surface-variant font-normal">Bandes Réseau 5G SA/NSA</span>
                      </td>
                      <td><span class="px-2 py-0.5 rounded bg-surface-container text-[10px]">Spécifications Techniques</span></td>
                      <td><span class="font-mono text-primary text-[10px]">Enum Multi</span></td>
                      <td>Variation & Filtre Catalog</td>
                      <td><span class="text-emerald-400">✓ Oui</span></td>
                      <td class="text-right font-mono tabular-nums">30 bandes</td>
                    </tr>
                    <tr>
                      <td class="py-3">
                        <span class="font-bold block">battery_capacity_mah</span>
                        <span class="text-[10px] text-on-surface-variant font-normal">Capacité Batterie (mAh)</span>
                      </td>
                      <td><span class="px-2 py-0.5 rounded bg-surface-container text-[10px]">Alimentation</span></td>
                      <td><span class="font-mono text-primary text-[10px]">Number</span></td>
                      <td>Spécification Fiche Tech</td>
                      <td><span class="text-emerald-400">✓ Oui</span></td>
                      <td class="text-right font-mono tabular-nums">Plage 3000-10000</td>
                    </tr>
                    <tr>
                      <td class="py-3">
                        <span class="font-bold block">purity_grade</span>
                        <span class="text-[10px] text-on-surface-variant font-normal">Degré de Pureté Artisanale</span>
                      </td>
                      <td><span class="px-2 py-0.5 rounded bg-surface-container text-[10px]">Qualité Matériaux</span></td>
                      <td><span class="font-mono text-primary text-[10px]">Enum Select</span></td>
                      <td>Certification CAJ Jijel</td>
                      <td><span class="text-emerald-400">✓ Oui</span></td>
                      <td class="text-right font-mono tabular-nums">Série A/B/C</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } else if (view === "categories") {
        innerViewHtml = `
          <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Arborescence & Taxonomie des Catégories</h3>
            
            <div class="space-y-2 text-xs font-semibold">
              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center gap-2">
                <span>📁</span>
                <span>Électronique & High-Tech</span>
                <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">12,400 vendables</span>
              </div>
              <div class="pl-6 space-y-2 border-l-2 border-outline-variant/25">
                <div class="p-3 bg-surface-container/60 rounded-xl flex items-center gap-2">
                  <span>📱</span>
                  <span>Smartphones & Mobiles</span>
                  <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">8,200 vendables</span>
                </div>
                <div class="pl-6 space-y-2 border-l-2 border-outline-variant/25">
                  <div class="p-3 bg-surface-container/40 rounded-xl flex items-center gap-2 text-[11px]">
                    <span>🔹</span>
                    <span>Modèles Premium Xiaomi (Xiaomi 18 Pro / Ultra)</span>
                    <span class="text-[10px] text-primary font-mono tabular-nums ml-auto">14 variantes EAV</span>
                  </div>
                </div>
                <div class="p-3 bg-surface-container/60 rounded-xl flex items-center gap-2">
                  <span>💻</span>
                  <span>Ordinateurs & Accessoires</span>
                  <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">4,200 vendables</span>
                </div>
              </div>

              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center gap-2 mt-4">
                <span>📁</span>
                <span>Artisanat, Poudres & Matériaux (Collectifs CAJ Jijel)</span>
                <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">80 vendables</span>
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
                <p class="text-[10px] text-on-surface-variant mt-0.5">Validation atomique des suggestions proposées par les marchands et collectifs</p>
              </div>
              <button onclick="alert('Formulaire de proposition activé !');" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs cursor-pointer">Nouvelle Proposition</button>
            </div>

            <div class="space-y-4">
              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                <div class="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h4 class="text-xs font-bold text-on-surface">Proposition #PROP-0019 : Xiaomi 18 Ultra Plus 1TB Ceramic Edition</h4>
                    <p class="text-[10px] text-on-surface-variant mt-0.5">Proposé par : Space Tech_Dealer_Jijel · Réf suggérée : REF-XIAOMI-18-ULTRA-PLUS</p>
                  </div>
                  <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">InReview</span>
                </div>
                <p class="text-[11px] text-on-surface-variant leading-relaxed">Ajout d'une nouvelle variante de Xiaomi avec 1TB de stockage, batterie 8500mAh et certification réseau 5G SA/NSA.</p>
                <div class="pt-3 border-t border-outline-variant/10 flex justify-end gap-2 text-xs">
                  <button onclick="alert('Demande de modification envoyée');" class="px-3 py-1.5 rounded-lg hover:bg-surface-variant/40 text-amber-400 font-bold cursor-pointer">Demander Modifications</button>
                  <button onclick="alert('Proposition rejetée');" class="px-3 py-1.5 rounded-lg hover:bg-surface-variant/40 text-rose-400 font-bold cursor-pointer">Rejeter</button>
                  <button onclick="alert('Proposition approuvée ! Vendable créé atomiquement.');" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold cursor-pointer">Approuver & Publier Vendable</button>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (view === "bulk") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Import & Export de Masse (Bulk CSV / JSON / JSON-LD)</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5">Validation en amont, parsing sécurisé isSafeAttributeKey et rapports d'erreurs ligne par ligne</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Import Card -->
              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                <div class="flex items-center gap-2">
                  <span class="text-xl">📥</span>
                  <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider">Assistant d'Importation CSV/JSON</h4>
                </div>
                <p class="text-[11px] text-on-surface-variant">Importez jusqu'à 5000 lignes de vendables avec contrôles d'intégrité EAV automatique.</p>
                <div class="p-6 border-2 border-dashed border-outline-variant/30 rounded-xl text-center cursor-pointer hover:border-primary/50 transition">
                  <span class="text-2xl block mb-1">📄</span>
                  <span class="text-xs font-bold text-on-surface block">Glisser un fichier CSV ou JSON ici</span>
                  <span class="text-[10px] text-on-surface-variant">Supporte le format CS-Cart et le schéma canonique Portfolio</span>
                </div>
                <button onclick="alert('Lancement du parser CSV de démonstration');" class="w-full py-2 rounded-xl bg-primary text-on-primary font-bold text-xs">Simuler Prévisualisation Import (1200 lignes)</button>
              </div>

              <!-- Export Card -->
              <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                <div class="flex items-center gap-2">
                  <span class="text-xl">📤</span>
                  <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider">Exportation Filtrée du Catalogue</h4>
                </div>
                <p class="text-[11px] text-on-surface-variant">Téléchargez la base complète ou filtrée pour votre ERP / gestion commerciale externe.</p>
                <div class="space-y-2 text-xs">
                  <label class="block text-[10px] font-bold text-on-surface-variant">Format d'exportation :</label>
                  <select class="w-full p-2 rounded-xl bg-surface-container border border-outline-variant/20 text-on-surface font-semibold text-xs">
                    <option>CSV Canonique MosaiX (UTF-8)</option>
                    <option>JSON-LD Schema.org / Product</option>
                    <option>Export CS-Cart Compatible (14 tables)</option>
                  </select>
                </div>
                <button onclick="alert('Génération du fichier de téléchagement...');" class="w-full py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-on-surface font-bold text-xs">Générer l'Exportation</button>
              </div>
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
              <button onclick="alert('Fiche produit complète avec checklist qualité ouverte !');" class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-[10px] font-bold text-on-surface cursor-pointer">
                Fiche & Qualité (${p.qualityScore}%)
              </button>
            </div>
          </div>
        `).join("");

        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Catalogue des Vendables (${PRODUCTS.length} affichés)</h2>
              <div class="flex items-center gap-2">
                <input type="text" placeholder="Rechercher par référence, nom, attribut EAV..." class="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/20 text-xs text-on-surface w-64" />
                <button onclick="alert('Filtres à facettes appliqués');" class="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs">Filtrer</button>
              </div>
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
