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
    icon: "🛒",
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
          </div>` : offers.map((o) => `
          <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
            <div class="space-y-3">
              <div class="flex justify-between items-start">
                <h3 class="text-xs font-bold text-on-surface mt-1">${escapeHtml(o.title)}</h3>
              </div>
              ${o.description ? `<p class="text-[11px] text-on-surface-variant leading-relaxed">${escapeHtml(o.description)}</p>` : ""}
              <div class="flex items-center gap-1.5 text-[10px] text-on-surface-variant/80">
                <span>${escapeHtml(o.seller.name ?? o.seller.id)}</span>
                <span aria-hidden="true" class="text-outline-variant/40">·</span>
                <span>Stock : <strong class="font-mono tabular-nums">${o.stockAllocation ?? "illimité"}</strong></span>
              </div>
            </div>
            <div class="pt-4 mt-4 border-t border-outline-variant/10 flex items-center justify-between">
              <span class="text-xs font-mono tabular-nums font-bold text-primary">${formatMoney(o.priceInCents, o.currency)}</span>
              <a href="/commerce?view=cart" class="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-on-primary text-[10px] font-bold transition cursor-pointer">
                Ajouter au panier
              </a>
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
              ${isGuest ? "" : `
              <a href="/commerce?view=cart" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${view === 'cart' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                <span class="material-symbols-outlined text-sm">shopping_cart</span>
                <span>Panier</span>
              </a>
              <a href="/commerce?view=orders" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${view === 'orders' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                <span class="material-symbols-outlined text-sm">receipt_long</span>
                <span>Commandes</span>
              </a>`}
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

function formatMoney(priceInCents: number, currency: string): string {
  const major = (Number.isFinite(priceInCents) ? priceInCents : 0) / 100;
  return `${major.toFixed(2)} ${currency || "EUR"}`;
}

export type { CommerceOffer };
