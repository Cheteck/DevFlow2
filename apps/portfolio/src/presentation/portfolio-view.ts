/**
 * @apps/portfolio — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Portfolio & Catalog.
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
      const view = context.request.query.view || "all";

      let innerViewHtml: string;
      if (view === "categories") {
        innerViewHtml = `
          <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Arborescence des Catégories</h3>
            
            <div class="space-y-2 text-xs font-semibold">
              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center gap-2">
                <span>📁</span>
                <span>Électronique & High-Tech</span>
                <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">12 produits</span>
              </div>
              <div class="pl-6 space-y-2 border-l-2 border-outline-variant/25">
                <div class="p-3 bg-surface-container/60 rounded-xl flex items-center gap-2">
                  <span>📱</span>
                  <span>Smartphones & Mobiles</span>
                  <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">4 produits</span>
                </div>
                <div class="p-3 bg-surface-container/60 rounded-xl flex items-center gap-2">
                  <span>💻</span>
                  <span>Ordinateurs & Accessoires</span>
                  <span class="text-[10px] text-on-surface-variant font-normal ml-auto font-mono tabular-nums">8 produits</span>
                </div>
              </div>

              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center gap-2 mt-4">
                <span>📁</span>
                <span>Mode & Joaillerie</span>
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
      } else if (view === "proposals") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Propositions d'Ajouts (Workflow)</h3>
              <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Formulaire initie !'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs cursor-pointer">Nouvelle Proposition</button>
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
                  <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Proposition rejetee'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="px-3 py-1.5 rounded-lg hover:bg-surface-variant/40 text-rose-400 font-bold cursor-pointer">Rejeter</button>
                  <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Proposition approuvee !'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold cursor-pointer">Approuver</button>
                </div>
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
              <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Edition de cet article activee'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-[10px] font-bold text-on-surface cursor-pointer">
                Éditer
              </button>
            </div>
          </div>
        `).join("");

        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Catalogue des Vendables</h2>
              <span class="text-xs text-on-surface-variant">Aperçu et configuration globale de vos offres</span>
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
                <p class="text-[11px] text-on-surface-variant">Gestion de catalogue de vendables (EAV, caractéristiques CS-Cart, validation)</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/portfolio?view=all" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Tous les Produits
              </a>
              <a href="/portfolio?view=categories" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'categories' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Catégories
              </a>
              <a href="/portfolio?view=proposals" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'proposals' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Propositions
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
