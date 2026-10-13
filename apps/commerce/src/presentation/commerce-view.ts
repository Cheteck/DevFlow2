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
import { CommerceOfferService, getOfferAvailability, type CommerceOffer } from "../domain/commerce-offer.model.js";
import { OrderService } from "../domain/order.service.js";

export interface CommerceDescriptorDeps {
  offerService?: CommerceOfferService;
  orderService?: OrderService;
}

export type CommerceView = "offers" | "cart" | "orders";

/**
 * Normalizes the `?view=` parameter. Unknown values fall back to the
 * public vitrine — the SSR access guard (`resolveBacAccess`, strict views)
 * already refused anything it should refuse; this default only keeps
 * direct descriptor users on a predictable view.
 */
export function resolveView(raw: unknown): CommerceView {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate === "offers" || candidate === "cart" || candidate === "orders") {
    return candidate;
  }
  return "offers";
}

export function createCommerceDescriptor(deps: CommerceDescriptorDeps = {}): BacDescriptor {
  // Explicit wiring: production MUST inject both services (bac-wiring.ts).
  // A missing service renders a configuration-error state — never an empty
  // business state, which would masquerade a broken deployment as "no data".
  const offerService = deps.offerService;
  const orderService = deps.orderService;

  return {
    id: "@apps/commerce",
    name: "Commerce Marketplace",
    version: "1.0.0",
    routePrefix: "/commerce",
    icon: "🏪",
    isEnabled: true,
    // Declarative only: the SSR route guard (bac-access policy) and the MCP
    // permission gate enforce access — this descriptor never grants it.
    requiredPermissions: ["commerce:order:create"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const view = resolveView(context.request.query.view);
      // Auth boundary: the explicit session flag from the execution context.
      // Roles NEVER decide this — an authenticated user may carry zero roles
      // and a role list is not an authentication proof. The SSR guard stays
      // the primary enforcement; this is defense in depth.
      const isGuest = context.user.isAuthenticated !== true;
      // Offer count for the tabs header (populated by the offers branch).
      let offerCount = 0;

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
        // No cart backend yet (BACKLOG): say so explicitly. The copy must
        // never imply that adding to cart works.
        subViewHtml = `
          <div class="space-y-6">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Votre Panier</h2>
            <div class="glass-card rounded-2xl p-8 text-center space-y-4">
              <div class="text-3xl">🛒</div>
              <h3 class="text-sm font-bold text-on-surface">Panier indisponible pour le moment</h3>
              <p class="text-xs text-on-surface-variant">La gestion du panier est en cours d'implémentation. En attendant, parcourez la boutique.</p>
              <a href="/commerce?view=offers" class="inline-block px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">Voir la boutique</a>
            </div>
          </div>
        `;
      } else if (view === "orders") {
        // Missing wiring is a configuration error, never "no orders".
        // Query failures propagate to the centralized SSR error boundary
        // (start.ts) instead of rendering a false empty state.
        // NOTE: `context.user.id` is the display-profile id, not yet the
        // session identity (AUTH-05 IdentityProfilePort) — per-user scoping
        // becomes exact when the identity projection lands.
        if (!orderService) {
          return serviceUnavailable("Mes Commandes", "Le service des commandes n'est pas configuré.");
        }
        const userId = context.user.id;
        const orders = await orderService.listOrdersByUser(userId);
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
              ${orders.map((o) => {
                let totalLabel = "Total indisponible";
                try {
                  totalLabel = formatMoneyStrict(Number(o.totalAmount ?? NaN), String(o.currency ?? ""));
                } catch {
                  // totalLabel stays honest; the order still renders.
                }
                return `
              <div class="glass-card rounded-2xl p-5 border border-outline-variant/20 space-y-4">
                <div class="flex justify-between items-start border-b border-outline-variant/10 pb-3 flex-wrap gap-2">
                  <div>
                    <h3 class="text-xs font-bold text-on-surface">Commande #${escapeHtml(String(o.id))}</h3>
                    <p class="text-[10px] text-on-surface-variant">Placée le ${escapeHtml(formatOrderDate(o.createdAt))}</p>
                  </div>
                  <span class="text-[10px] font-bold text-primary uppercase tracking-wider">
                    ${escapeHtml(String(o.status ?? ""))}
                  </span>
                </div>
                <div class="flex justify-between items-center text-xs font-mono tabular-nums">
                  <span class="text-on-surface-variant">Total :</span>
                  <span class="font-bold text-primary">${totalLabel}</span>
                </div>
              </div>`; }).join("")}
            </div>
          </div>
        `;
      } else {
        // Default offers list — real ACTIVE offers, newest first.
        if (!offerService) {
          return serviceUnavailable("Boutique", "Le service de la vitrine n'est pas configuré.");
        }
        const offers = await offerService.listAllActive();
        offerCount = offers.length;
        const gridHtml = offers.length === 0 ? `
          <div class="col-span-full glass-card rounded-2xl p-8 text-center space-y-4">
            <div class="text-3xl">🏪</div>
            <h3 class="text-sm font-bold text-on-surface">Aucune offre publiée pour le moment</h3>
            <p class="text-xs text-on-surface-variant">Les Spaces vendeurs n'ont pas encore publié d'offres. Revenez bientôt.</p>
          </div>` : offers.map((o) => {
          const searchable = `${o.title} ${o.description ?? ""} ${o.seller.name ?? o.seller.id}`.toLowerCase();
          const initial = (o.seller.name ?? o.seller.id ?? "?").trim().charAt(0).toUpperCase() || "?";
          // Strict per-card money: invalid amounts never render as 0.00.
          let priceLabel = "Prix indisponible";
          let priceAttr = "-1";
          try {
            priceLabel = formatMoneyStrict(o.priceInCents, o.currency);
            priceAttr = String(o.priceInCents);
          } catch {
            // priceLabel stays honest; card still renders.
          }
          const availability = getOfferAvailability(o.stockAllocation);
          return `
          <article class="offer-card glass-card rounded-2xl border border-outline-variant/20 flex flex-col hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition duration-200 overflow-hidden"
            data-search="${escapeHtml(searchable)}" data-price="${priceAttr}" data-created="${escapeHtml(o.createdAt)}">
            <div class="h-28 bg-gradient-to-br from-primary/15 via-surface-container to-surface-container-low flex items-center justify-center text-4xl font-bold text-primary/60 select-none" aria-hidden="true">
              ${escapeHtml(initial)}
            </div>
            <div class="p-4 space-y-3 flex flex-col flex-1">
              <div class="flex items-center gap-1.5 text-[11px] min-w-0">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span class="font-medium text-on-surface-variant truncate">${escapeHtml(o.seller.name ?? o.seller.id)}</span>
              </div>
              <h3 class="text-xs font-bold text-on-surface leading-snug line-clamp-2 min-h-[2rem]">${escapeHtml(o.title)}</h3>
              <div class="bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 flex items-baseline justify-between">
                <span class="text-[10px] text-on-surface-variant">Prix</span>
                <span class="text-sm font-mono tabular-nums font-bold text-primary">${priceLabel}</span>
              </div>
              <div class="flex items-center gap-1.5 text-[11px] font-medium ${availabilityToneClass(availability.tone)}">
                <span class="w-1.5 h-1.5 rounded-full ${availabilityDotClass(availability.tone)}"></span>
                ${escapeHtml(availability.label)}
              </div>
              ${isGuest ? `
              <a href="/commerce?view=cart" class="mt-auto block text-center w-full py-2 rounded-xl bg-primary/10 hover:bg-primary hover:text-on-primary text-primary text-[11px] font-bold border border-primary/25 transition cursor-pointer">
                Ajouter au panier
              </a>` : `
              <span class="mt-auto block text-center w-full py-2 rounded-xl bg-surface-container border border-outline-variant/20 text-on-surface-variant text-[11px] font-bold cursor-not-allowed" title="La gestion du panier est en cours d'implémentation">
                Panier bientôt disponible
              </span>`}
            </div>
          </article>`;
        }).join("");

        subViewHtml = `
          <div class="space-y-4">
            <section class="glass-card rounded-2xl border border-outline-variant/15 p-4" data-purpose="marketplace-toolbar">
              <div class="flex flex-col md:flex-row md:items-center gap-3">
                <div class="relative flex-1 min-w-0">
                  <label for="offer-search" class="sr-only">Rechercher dans les offres affichées</label>
                  <span class="material-symbols-outlined text-sm text-on-surface-variant/60 absolute left-3 top-2.5 pointer-events-none">search</span>
                  <input id="offer-search" type="search" placeholder="Rechercher parmi les ${offers.length} offre(s) affichée(s)…"
                  class="w-full bg-surface-container border border-outline-variant/20 focus:border-primary/50 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none transition" />
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span id="offer-count" aria-live="polite" class="text-[11px] text-on-surface-variant font-medium">${offers.length} offre(s)</span>
                <label for="offer-sort" class="sr-only">Trier les offres</label>
                <select id="offer-sort" class="bg-surface-container border border-outline-variant/20 rounded-xl px-2.5 py-2 text-xs text-on-surface focus:outline-none cursor-pointer">
                  <option value="new">Plus récentes</option>
                  <option value="asc">Prix croissant</option>
                  <option value="desc">Prix décroissant</option>
                </select>
              </div>
            </div>
            </section>
            <p id="offer-empty-search" class="hidden text-xs text-on-surface-variant/70 italic text-center py-6">Aucune offre ne correspond à cette recherche.</p>

            <div id="offer-grid" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              ${gridHtml}
            </div>

            <footer class="border-t border-outline-variant/15 pt-4 pb-2 flex items-center justify-between gap-4 text-[11px] text-on-surface-variant">
              <span>Affichage de <strong class="text-on-surface">${offers.length}</strong> offre(s) publiée(s)</span>
            </footer>
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
          <div class="flex items-center justify-between gap-2 border-b border-outline-variant/15">
          <div class="flex gap-1">
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
          ${view === "offers" ? `<span class="text-[11px] text-on-surface-variant font-medium pb-2">${offerCount} offre(s)</span>` : ""}
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

function serviceUnavailable(title: string, message: string): BacRenderResult {
  return {
    contentHtml: `
      <div class="space-y-6">
        <div class="glass-card rounded-2xl p-8 text-center space-y-4 border-red-500/20">
          <div class="text-3xl">⚠️</div>
          <h2 class="text-sm font-bold text-on-surface">${escapeHtml(title)}</h2>
          <p class="text-xs text-on-surface-variant">${escapeHtml(message)} Réessayez dans un instant.</p>
        </div>
      </div>`,
    pageTitle: "Commerce — Service indisponible",
  };
}

const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * Strict monetary formatting: integer minor units + allowlisted ISO code,
 * locale-aware display. Throws on invalid input — callers render an explicit
 * "indisponible" state per card instead of a fabricated 0.00.
 */
export function formatMoneyStrict(priceInCents: number, currency: string, locale = "fr-FR"): string {
  if (!Number.isSafeInteger(priceInCents)) {
    throw new Error("Invalid monetary amount: integer minor units required.");
  }
  if (typeof currency !== "string" || !ISO_CURRENCY_PATTERN.test(currency)) {
    throw new Error("Invalid currency: ISO 4217 code required.");
  }
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(priceInCents / 100);
  } catch {
    return `${(priceInCents / 100).toFixed(2)} ${currency}`;
  }
}

/** Strict monetary display is the only formatter; invalid data throws. */
function availabilityToneClass(tone: "ok" | "warn" | "out" | "unknown"): string {
  if (tone === "warn") return "text-amber-400";
  if (tone === "out") return "text-rose-400";
  if (tone === "unknown") return "text-on-surface-variant";
  return "text-emerald-400";
}

function availabilityDotClass(tone: "ok" | "warn" | "out" | "unknown"): string {
  if (tone === "warn") return "bg-amber-400";
  if (tone === "out") return "bg-rose-400";
  if (tone === "unknown") return "bg-slate-400";
  return "bg-emerald-400";
}

function formatOrderDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return "Date inconnue";
  }
}

export type { CommerceOffer };
