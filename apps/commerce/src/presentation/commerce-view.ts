/**
 * @apps/commerce — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Commerce (Orders, Checkout & Offers).
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";

export function createCommerceDescriptor(): BacDescriptor {
  // Static seed of default marketplace offers
  const OFFERS = [
    { id: "off-001", title: "Xiaomi 18 Pro Max 5G", price: 1249, rating: "4.9", category: "Électronique", stock: 12, description: "Snapdragon 8 Elite, 8500mAh, 5G 30 bands." },
    { id: "off-002", title: "Bague de fiançailles Amel", price: 2450, rating: "5.0", category: "Bijouterie", stock: 2, description: "Or pur 18 carats avec diamant certifié GIA." },
    { id: "off-003", title: "Cafetière Espresso Vintage", price: 189, rating: "4.7", category: "Maison", stock: 15, description: "Style italien avec moulin à grains intégré." },
    { id: "off-004", title: "Montre de sport Chronos 2", price: 349, rating: "4.8", category: "Montres", stock: 8, description: "Suivi cardiaque et GPS intégré, étanche 50m." }
  ];

  return {
    id: "@apps/commerce",
    name: "Commerce Marketplace",
    version: "1.0.0",
    routePrefix: "/commerce",
    icon: "🛒",
    isEnabled: true,
    requiredPermissions: ["commerce:order:create"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const view = context.request.query.view || "offers";

      let subViewHtml: string;
      if (view === "cart") {
        subViewHtml = `
          <div class="space-y-6">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Votre Panier</h2>
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              <!-- Cart Items -->
              <div class="lg:col-span-8 space-y-4">
                <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 flex gap-4 items-center">
                  <div class="w-12 h-12 rounded-xl bg-surface-variant flex items-center justify-center text-xl shrink-0">📱</div>
                  <div class="flex-1 min-w-0">
                    <h3 class="text-xs font-bold text-on-surface truncate">Xiaomi 18 Pro Max 5G</h3>
                    <p class="text-[10px] text-on-surface-variant mt-0.5">Vendeur : Tech_Space_DZ</p>
                    <span class="text-xs font-mono tabular-nums font-bold text-primary mt-1 block">1 249.00 €</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <button class="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-xs border border-outline-variant/20 hover:bg-surface-container-high transition cursor-pointer">-</button>
                    <span class="text-xs font-bold font-mono tabular-nums">1</span>
                    <button class="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-xs border border-outline-variant/20 hover:bg-surface-container-high transition cursor-pointer">+</button>
                  </div>
                  <button onclick="this.closest('.glass-card').remove(); const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Article retire !'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="text-rose-400 hover:text-rose-300 p-2 cursor-pointer shrink-0" title="Supprimer">
                    <span class="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>

                <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 flex gap-4 items-center">
                  <div class="w-12 h-12 rounded-xl bg-surface-variant flex items-center justify-center text-xl shrink-0">☕</div>
                  <div class="flex-1 min-w-0">
                    <h3 class="text-xs font-bold text-on-surface truncate">Cafetière Espresso Vintage</h3>
                    <p class="text-[10px] text-on-surface-variant mt-0.5">Vendeur : Home_Deco</p>
                    <span class="text-xs font-mono tabular-nums font-bold text-primary mt-1 block">189.00 €</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <button class="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-xs border border-outline-variant/20 hover:bg-surface-container-high transition cursor-pointer">-</button>
                    <span class="text-xs font-bold font-mono tabular-nums">1</span>
                    <button class="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-xs border border-outline-variant/20 hover:bg-surface-container-high transition cursor-pointer">+</button>
                  </div>
                  <button onclick="this.closest('.glass-card').remove(); const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Article retire !'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="text-rose-400 hover:text-rose-300 p-2 cursor-pointer shrink-0" title="Supprimer">
                    <span class="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>

              <!-- Checkout Summary -->
              <div class="lg:col-span-4">
                <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
                  <h3 class="text-xs font-bold text-on-surface">Résumé de la commande</h3>
                  <div class="space-y-2 text-xs border-b border-outline-variant/10 pb-3 font-mono tabular-nums">
                    <div class="flex justify-between">
                      <span class="text-on-surface-variant">Sous-total :</span>
                      <span class="font-bold">1 438.00 €</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-on-surface-variant">Frais de livraison :</span>
                      <span class="font-bold text-emerald-400">Gratuit</span>
                    </div>
                  </div>
                  <div class="flex justify-between text-xs font-bold font-mono tabular-nums">
                    <span>Total :</span>
                    <span class="text-primary text-sm">1 438.00 €</span>
                  </div>

                  <!-- Mode de paiement -->
                  <div class="space-y-2 pt-2">
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mode de Paiement</label>
                    <div class="grid grid-cols-2 gap-2">
                      <label class="border border-primary/30 bg-primary/5 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition">
                        <input type="radio" name="payment-method" value="cod" class="hidden" checked />
                        <span class="text-xs font-bold">🚚 COD</span>
                        <span class="text-[9px] text-on-surface-variant mt-1">À la livraison (Algérie)</span>
                      </label>
                      <label class="border border-outline-variant/20 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-variant/30 transition">
                        <input type="radio" name="payment-method" value="cib" class="hidden" />
                        <span class="text-xs font-bold">💳 CIB / SATIM</span>
                        <span class="text-[9px] text-on-surface-variant mt-1">Paiement instantané</span>
                      </label>
                    </div>
                  </div>

                  <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Commande validee avec succes !'; document.body.appendChild(t); setTimeout(()=>window.location.href='/commerce?view=orders',2000);" class="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-indigo-500 text-on-primary text-xs font-bold hover:opacity-95 transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer">
                    <span class="material-symbols-outlined text-sm">shopping_cart_checkout</span>
                    <span>Confirmer la commande</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        `;
      } else if (view === "orders") {
        subViewHtml = `
          <div class="space-y-6">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Mes Commandes</h2>
            <div class="space-y-4">
              
              <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
                <div class="flex justify-between items-start border-b border-outline-variant/10 pb-3 flex-wrap gap-2">
                  <div>
                    <h3 class="text-xs font-bold text-on-surface">Commande #ORD-9284-85</h3>
                    <p class="text-[10px] text-on-surface-variant">Placée le 24 sept. 2026 à 20:12</p>
                  </div>
                  <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    En cours de livraison
                  </span>
                </div>
                <div class="flex gap-3 items-center">
                  <div class="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center text-lg">📱</div>
                  <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold truncate">Xiaomi 18 Pro Max 5G</h4>
                    <p class="text-[10px] text-on-surface-variant font-mono tabular-nums">1 x 1 249.00 €</p>
                  </div>
                  <span class="text-xs font-mono tabular-nums font-bold text-primary">1 249.00 €</span>
                </div>
                <div class="flex justify-between items-center pt-3 border-t border-outline-variant/10 text-[11px] text-on-surface-variant">
                  <span>Paiement : <strong class="text-on-surface font-semibold">COD (À la livraison)</strong></span>
                  <span>Livreur assigné : <strong class="text-on-surface font-semibold">Ali Express</strong></span>
                </div>
              </div>

              <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
                <div class="flex justify-between items-start border-b border-outline-variant/10 pb-3 flex-wrap gap-2">
                  <div>
                    <h3 class="text-xs font-bold text-on-surface">Commande #ORD-8103-24</h3>
                    <p class="text-[10px] text-on-surface-variant">Placée le 12 sept. 2026 à 14:05</p>
                  </div>
                  <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Livrée & Clôturée
                  </span>
                </div>
                <div class="flex gap-3 items-center">
                  <div class="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center text-lg">☕</div>
                  <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold truncate">Cafetière Espresso Vintage</h4>
                    <p class="text-[10px] text-on-surface-variant font-mono tabular-nums">1 x 189.00 €</p>
                  </div>
                  <span class="text-xs font-mono tabular-nums font-bold text-primary">189.00 €</span>
                </div>
                <div class="flex justify-between items-center pt-3 border-t border-outline-variant/10 text-[11px] text-on-surface-variant">
                  <span>Paiement : <strong class="text-on-surface font-semibold">CIB / SATIM (Payé)</strong></span>
                </div>
              </div>

            </div>
          </div>
        `;
      } else {
        // Default offers list
        const gridHtml = OFFERS.map(o => `
          <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
            <div class="space-y-3">
              <div class="flex justify-between items-start">
                <h3 class="text-xs font-bold text-on-surface mt-1">${escapeHtml(o.title)}</h3>
                <span class="text-[10px] text-amber-400 font-bold font-mono tabular-nums flex items-center gap-0.5">
                  ⭐ ${o.rating}
                </span>
              </div>
              <p class="text-[11px] text-on-surface-variant leading-relaxed">${escapeHtml(o.description)}</p>
              
              <div class="flex items-center gap-1.5 text-[10px] text-on-surface-variant/80">
                <span>${escapeHtml(o.category)}</span>
                <span aria-hidden="true" class="text-outline-variant/40">·</span>
                <span>Stock : <strong class="font-mono tabular-nums">${o.stock}</strong></span>
              </div>
            </div>
            <div class="pt-4 mt-4 border-t border-outline-variant/10 flex items-center justify-between">
              <span class="text-xs font-mono tabular-nums font-bold text-primary">${o.price.toFixed(2)} €</span>
              <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Article ajoute au panier !'; document.body.appendChild(t); setTimeout(()=>window.location.href='/commerce?view=cart',1500);" class="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-on-primary text-[10px] font-bold transition cursor-pointer">
                Ajouter au panier
              </button>
            </div>
          </div>
        `).join("");

        subViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Marché Décentralisé</h2>
                <p class="text-xs text-on-surface-variant mt-1">Explorez les offres d'achat direct et découvrez nos produits exclusifs.</p>
              </div>
              <div class="flex gap-2 text-xs">
                <select class="bg-surface-container border border-outline-variant/20 rounded-lg p-2 text-on-surface focus:outline-none">
                  <option>Toutes les Catégories</option>
                  <option>Électronique</option>
                  <option>Bijouterie</option>
                  <option>Maison</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              ${gridHtml}
            </div>
          </div>
        `;
      }

      const contentHtml = `
        <div class="space-y-6">
          
          <!-- Subnavigation -->
          <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">🛒</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Marketplace</h1>
                <p class="text-[11px] text-on-surface-variant">Achat direct et gestion des transactions</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/commerce?view=offers" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'offers' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Boutique
              </a>
              <a href="/commerce?view=cart" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${view === 'cart' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                <span class="material-symbols-outlined text-sm">shopping_cart</span>
                <span>Panier</span>
                <span class="px-1.5 py-0.2 rounded-full bg-primary-container text-on-primary text-[9px] font-bold font-mono tabular-nums">2</span>
              </a>
              <a href="/commerce?view=orders" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${view === 'orders' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                <span class="material-symbols-outlined text-sm">receipt_long</span>
                <span>Commandes</span>
              </a>
            </div>
          </div>

          <!-- Main Inner View -->
          ${subViewHtml}

        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Commerce — Boutique & Marketplace",
      };
    },
  };
}
