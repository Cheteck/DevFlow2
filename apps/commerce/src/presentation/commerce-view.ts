/**
 * @apps/commerce — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Commerce (Orders, Checkout & Offers).
 *
 * Data doctrine: every section reads from injected domain services (backed
 * by Postgres in production). No static seeds, no fabricated items — an
 * empty store renders an explicit empty state, never fake products.
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { CommerceOfferService, type CommerceOffer } from "../domain/commerce-offer.model.js";
import { OrderService } from "../domain/order.service.js";

export interface CommerceDescriptorDeps {
  offerService?: CommerceOfferService;
  orderService?: OrderService;
}

export function createCommerceDescriptor(deps: CommerceDescriptorDeps = {}): BacDescriptor {
  // Without a service the vitrine is honestly empty, never filled with
  // fabricated products.
  const offerService = deps.offerService ?? new CommerceOfferService();
  const orderService = deps.orderService;

  return {
    id: "@apps/commerce",
    name: "Commerce Marketplace",
    version: "1.0.0",
    routePrefix: "/commerce",
    icon: "🏪",
    isEnabled: true,
    requiredPermissions: ["commerce:order:create"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const rawView = context.request.query.view;
      const view = Array.isArray(rawView) ? rawView[0] : (rawView || "offers");
      // Guest boundary: anonymous execution contexts carry no roles (see
      // `src/start.ts`). Cart/orders are session views — the SSR guard
      // redirects guests to login, and this is the second lock: tabs are
      // hidden and direct renders show a login prompt instead of content.
      const isGuest = (context.user.roles?.length ?? 0) === 0;

      if (isGuest && (view === "cart" || view === "orders")) {
        const loginHere = `/login?next=${encodeURIComponent(`/commerce?view=${view}`)}`;
        const label = view === "cart" ? "votre panier" : "vos commandes";
        return {
          contentHtml: `
          <div class="space-y-6">
            <div class="glass-card rounded-2xl p-8 text-center space-y-4">
              <div class="text-3xl">🔒</div>
              <h2 class="text-sm font-bold text-on-surface">Connectez-vous pour voir ${label}</h2>
              <p class="text-xs text-on-surface-variant">La boutique reste librement consultable sans compte.</p>
              <a href="${loginHere}" class="inline-block px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">Se connecter</a>
            </div>
          </div>`,
          pageTitle: "Commerce — Connexion requise",
        };
      }

      let subViewHtml: string;
      if (view === "cart") {
        // No cart backend yet (BACKLOG): explicit empty state, never fake items.
        subViewHtml = `
          <div class="space-y-6">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Votre Panier</h2>
            <div class="glass-card rounded-2xl p-8 text-center space-y-4">
              <div class="text-3xl">🛒</div>
              <h3 class="text-sm font-bold text-on-surface">Votre panier est vide</h3>
              <p class="text-xs text-on-surface-variant">Parcourez la boutique et ajoutez des offres pour les retrouver ici.</p>
              <a href="/commerce?view=offers" class="inline-block px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">Voir la boutique</a>
            </div>
          </div>
        `;
      } else if (view === "orders") {
        const userId = context.user.id;
        const orders = orderService ? await orderService.listOrdersByUser(userId) : [];
        subViewHtml = orders.length === 0 ? `
          <div class="space-y-6">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Mes Commandes</h2>
            <div class="glass-card rounded-2xl p-8 text-center space-y-4">
              <div class="text-3xl">📦</div>
              <h3 class="text-sm font-bold text-on-surface">Aucune commande pour le moment</h3>
              <p class="text-xs text-on-surface-variant">Vos commandes validées apparaîtront ici avec leur suivi.</p>
              <a href="/commerce?view=offers" class="inline-block px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">Voir la boutique</a>
            </div>
          </div>
        ` : `
          <div class="space-y-6">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Mes Commandes</h2>
            <div class="space-y-4">
              ${orders.map((o) => `
              <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
                <div class="flex justify-between items-start border-b border-outline-variant/10 pb-3 flex-wrap gap-2">
                  <div>
                    <h3 class="text-xs font-bold text-on-surface">Commande #${escapeHtml(String(o.id))}</h3>
                    <p class="text-[10px] text-on-surface-variant">Placée le ${escapeHtml(String(o.createdAt ?? ""))}</p>
                  </div>
                  <span class="text-[10px] font-bold text-primary uppercase tracking-wider">
                    ${escapeHtml(String(o.status ?? ""))}
                  </span>
                </div>
                <div class="flex justify-between items-center text-xs font-mono tabular-nums">
                  <span class="text-on-surface-variant">Total :</span>
                  <span class="font-bold text-primary">${formatMoney(Number(o.totalAmount ?? 0), String(o.currency ?? "EUR"))}</span>
                </div>
              </div>`).join("")}
            </div>
          </div>
        `;
      } else {
        // Default offers list — real ACTIVE offers, newest first.
        const offers = await offerService.listAllActive();
        const gridHtml = offers.length === 0 ? `
          <div class="col-span-full glass-card rounded-2xl p-8 text-center space-y-4">
            <div class="text-3xl">🏪</div>
            <h3 class="text-sm font-bold text-on-surface">Aucune offre publiée pour le moment</h3>
            <p class="text-xs text-on-surface-variant">Les Spaces vendeurs n'ont pas encore publié d'offres. Revenez bientôt.</p>
          </div>` : offers.map((o) => {
          const searchable = `${o.title} ${o.description ?? ""} ${o.seller.name ?? o.seller.id}`.toLowerCase();
          const initial = (o.seller.name ?? o.seller.id ?? "?").trim().charAt(0).toUpperCase() || "?";
          return `
          <article class="offer-card glass-card rounded-2xl border border-outline-variant/20 flex flex-col hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition duration-200 overflow-hidden"
            data-search="${escapeHtml(searchable)}" data-price="${o.priceInCents}" data-created="${escapeHtml(o.createdAt)}">
            <div class="h-28 bg-gradient-to-br from-primary/15 via-surface-container to-surface-container-low flex items-center justify-center text-4xl font-bold text-primary/60 select-none" aria-hidden="true">
              ${escapeHtml(initial)}
            </div>
            <div class="p-4 space-y-2.5 flex flex-col flex-1">
              <h3 class="text-xs font-bold text-on-surface leading-snug">${escapeHtml(o.title)}</h3>
              <p class="text-[11px] text-on-surface-variant truncate">par ${escapeHtml(o.seller.name ?? o.seller.id)}</p>
              <div class="flex items-center justify-between mt-auto pt-2">
                <span class="text-sm font-mono tabular-nums font-bold text-primary">${formatMoney(o.priceInCents, o.currency)}</span>
                <span class="text-[10px] ${o.stockAllocation ? "text-on-surface-variant" : "text-emerald-400"} font-semibold">${o.stockAllocation ? `Stock : ${o.stockAllocation}` : "En stock"}</span>
              </div>
              <a href="/commerce?view=cart" class="block text-center w-full py-2 rounded-xl bg-primary/10 hover:bg-primary hover:text-on-primary text-primary text-[11px] font-bold border border-primary/25 transition cursor-pointer">
                Ajouter au panier
              </a>
            </div>
          </article>`;
        }).join("");

        subViewHtml = `
          <div class="space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center gap-3">
              <div class="relative flex-1 min-w-0">
                <span class="material-symbols-outlined text-sm text-on-surface-variant/60 absolute left-3 top-2.5 pointer-events-none">search</span>
                <input id="offer-search" type="search" placeholder="Rechercher dans les ${offers.length} offre(s) affichée(s)…"
                  class="w-full bg-surface-container border border-outline-variant/20 focus:border-primary/50 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none transition" />
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span id="offer-count" class="text-[11px] text-on-surface-variant font-medium">${offers.length} offre(s)</span>
                <select id="offer-sort" class="bg-surface-container border border-outline-variant/20 rounded-xl px-2.5 py-2 text-xs text-on-surface focus:outline-none cursor-pointer">
                  <option value="new">Plus récentes</option>
                  <option value="asc">Prix croissant</option>
                  <option value="desc">Prix décroissant</option>
                </select>
              </div>
            </div>
            <p id="offer-empty-search" class="hidden text-xs text-on-surface-variant/70 italic text-center py-6">Aucune offre ne correspond à cette recherche.</p>

            <div id="offer-grid" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              ${gridHtml}
            </div>
          </div>
          <script>
          (function() {
            var grid = document.getElementById('offer-grid');
            var input = document.getElementById('offer-search');
            var sort = document.getElementById('offer-sort');
            var count = document.getElementById('offer-count');
            var emptyMsg = document.getElementById('offer-empty-search');
            if (!grid || !input || !sort) return;
            function apply() {
              var q = input.value.toLowerCase().trim();
              var cards = Array.prototype.slice.call(grid.querySelectorAll('.offer-card'));
              var visible = 0;
              cards.forEach(function(card) {
                var hit = !q || (card.getAttribute('data-search') || '').indexOf(q) !== -1;
                card.classList.toggle('hidden', !hit);
                if (hit) visible++;
              });
              var mode = sort.value;
              var shown = cards.filter(function(card) { return !card.classList.contains('hidden'); });
              shown.sort(function(a, b) {
                if (mode === 'asc') return (+a.dataset.price) - (+b.dataset.price);
                if (mode === 'desc') return (+b.dataset.price) - (+a.dataset.price);
                return (b.dataset.created || '').localeCompare(a.dataset.created || '');
              });
              shown.forEach(function(card) { grid.appendChild(card); });
              if (count) count.textContent = visible + ' offre(s)';
              if (emptyMsg) emptyMsg.classList.toggle('hidden', visible !== 0);
            }
            input.addEventListener('input', apply);
            sort.addEventListener('change', apply);
          })();
          </script>
          </div>
        `;
      }

      // Compact in-view tabs (the shell header already shows the title —
      // no duplicated header block here).
      const contentHtml = `
        <div class="space-y-5">
          <div class="flex gap-1 border-b border-outline-variant/15">
            <a href="/commerce?view=offers" class="px-4 py-2 text-xs font-bold transition border-b-2 -mb-px ${view === 'offers' ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}">
              Boutique
            </a>
            ${isGuest ? "" : `
            <a href="/commerce?view=cart" class="px-4 py-2 text-xs font-bold transition border-b-2 -mb-px flex items-center gap-1.5 ${view === 'cart' ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}">
              <span class="material-symbols-outlined text-sm">shopping_cart</span>
              <span>Panier</span>
            </a>
            <a href="/commerce?view=orders" class="px-4 py-2 text-xs font-bold transition border-b-2 -mb-px flex items-center gap-1.5 ${view === 'orders' ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}">
              <span class="material-symbols-outlined text-sm">receipt_long</span>
              <span>Commandes</span>
            </a>`}
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

function formatMoney(priceInCents: number, currency: string): string {
  const major = (Number.isFinite(priceInCents) ? priceInCents : 0) / 100;
  return `${major.toFixed(2)} ${currency || "EUR"}`;
}

export type { CommerceOffer };
