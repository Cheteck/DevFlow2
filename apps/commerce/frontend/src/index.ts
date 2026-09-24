import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

export const CommerceOrdersAdminPageView = {
  id: "commerce-orders-admin-page",
  render(): string {
    return `
      <div class="space-y-6">
        <div id="commerce-toast-container" class="fixed bottom-5 right-5 z-50 pointer-events-none"></div>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-on-surface">Journal des Commandes & Saga</h3>
            <p class="text-xs text-on-surface-variant">Surveillance des transactions de checkout et orchestrations Saga distribuées.</p>
          </div>
          <button onclick="showCommerceToast('Synchronisation du catalogue terminée !', 'success')" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition">
            <span class="material-symbols-outlined text-sm">sync</span> Sync Stock
          </button>
        </div>

        <div class="overflow-x-auto rounded-xl border border-outline-variant/20 bg-surface-container/40">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-outline-variant/20 text-on-surface-variant font-semibold bg-surface-container/60">
                <th class="p-3">ID Commande</th>
                <th class="p-3">Client</th>
                <th class="p-3">Produit</th>
                <th class="p-3">Montant</th>
                <th class="p-3">Statut Saga</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/10 text-on-surface">
              <tr class="hover:bg-surface-variant/10">
                <td class="p-3 font-mono text-purple-300">#ORD-9021</td>
                <td class="p-3 font-semibold">Alice V.</td>
                <td class="p-3">Serveur Cloud Pro</td>
                <td class="p-3 font-bold">149.00 €</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">COMPLETED</span></td>
                <td class="p-3 text-right"><button onclick="showCommerceToast('Facture #ORD-9021 téléchargeable', 'info')" class="text-primary hover:underline text-xs">Détails</button></td>
              </tr>
              <tr class="hover:bg-surface-variant/10">
                <td class="p-3 font-mono text-purple-300">#ORD-9022</td>
                <td class="p-3 font-semibold">Benoît D.</td>
                <td class="p-3">Pack Entreprise Plus</td>
                <td class="p-3 font-bold">299.00 €</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">RESERVING</span></td>
                <td class="p-3 text-right"><button onclick="showCommerceToast('Commande #ORD-9022 en cours de traitement', 'info')" class="text-primary hover:underline text-xs">Détails</button></td>
              </tr>
              <tr class="hover:bg-surface-variant/10">
                <td class="p-3 font-mono text-purple-300">#ORD-9023</td>
                <td class="p-3 font-semibold">Claire M.</td>
                <td class="p-3">Licence Développeur</td>
                <td class="p-3 font-bold">49.00 €</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">COMPLETED</span></td>
                <td class="p-3 text-right"><button onclick="showCommerceToast('Facture #ORD-9023 téléchargeable', 'info')" class="text-primary hover:underline text-xs">Détails</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <script>
        window.showCommerceToast = window.showCommerceToast || function(msg, type) {
          let prefix = "";
          if (type === 'error') prefix = "Erreur: ";
          if (type === 'success') prefix = "Succès: ";
          window.alert(prefix + msg);
        };
      </script>
    `;
  }
};

shellRegistry.registerAdminPage({
  id: "commerce-admin-orders",
  bacId: "@apps/commerce",
  title: "Commandes & Ventes",
  description: "Suivi des commandes du catalogue, expéditions et transactions Saga",
  icon: "storefront",
  route: "/commerce/admin/orders",
  category: "commerce",
  order: 30,
  badge: { text: "Saga Active", variant: "purple" },
  metrics: [
    { id: "orders-pending", label: "Commandes en Cours", value: 3, status: "nominal", icon: "receipt_long" },
    { id: "revenue-today", label: "Ventes du Jour", value: "2 140 €", change: "+18%", status: "nominal", icon: "payments" }
  ],
  render: () => CommerceOrdersAdminPageView.render()
});

export const CommerceStyles = `
  .commerce-container {
    max-width: 1100px;
    margin: 0 auto;
    font-family: system-ui, -apple-system, sans-serif;
    color: #f3f4f6;
    padding: 24px;
  }
  .commerce-header {
    margin-bottom: 32px;
  }
  .commerce-header h1 {
    font-size: 2rem;
    font-weight: 800;
    color: #f9fafb;
    margin-bottom: 8px;
  }
  .commerce-header p {
    font-size: 0.95rem;
    color: #9ca3af;
  }
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin-bottom: 40px;
  }
  .product-card {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.2s, border-color 0.2s;
  }
  .product-card:hover {
    transform: translateY(-2px);
    border-color: #3b82f6;
  }
  .product-badge {
    align-self: flex-start;
    background: #1e3a8a;
    color: #93c5fd;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 9999px;
    margin-bottom: 12px;
  }
  .product-title {
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: #f9fafb;
  }
  .product-desc {
    font-size: 0.85rem;
    color: #9ca3af;
    margin-bottom: 16px;
    line-height: 1.4;
  }
  .product-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
  }
  .product-price {
    font-size: 1.25rem;
    font-weight: 800;
    color: #f3f4f6;
  }
  .buy-btn {
    background: #3b82f6;
    color: white;
    font-weight: 600;
    font-size: 0.85rem;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
  }
  .buy-btn:hover {
    background: #2563eb;
  }
  .saga-container {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    padding: 24px;
    margin-top: 32px;
  }
  .saga-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .saga-steps {
    display: flex;
    justify-content: space-between;
    position: relative;
    margin-top: 24px;
    padding-bottom: 8px;
  }
  .saga-steps::before {
    content: "";
    position: absolute;
    top: 16px;
    left: 40px;
    right: 40px;
    height: 3px;
    background: #374151;
    z-index: 1;
  }
  .saga-steps-progress {
    position: absolute;
    top: 16px;
    left: 40px;
    width: 0%;
    height: 3px;
    background: #10b981;
    z-index: 2;
    transition: width 0.8s ease;
  }
  .saga-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 3;
    width: 80px;
    text-align: center;
  }
  .step-circle {
    width: 32px;
    height: 32px;
    border-radius: 9999px;
    background: #1f2937;
    border: 2px solid #374151;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
    color: #9ca3af;
    transition: all 0.3s ease;
  }
  .step-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #9ca3af;
    margin-top: 8px;
    transition: color 0.3s ease;
  }
  .saga-step.active .step-circle {
    background: #1e3a8a;
    border-color: #3b82f6;
    color: #60a5fa;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
  }
  .saga-step.completed .step-circle {
    background: #065f46;
    border-color: #10b981;
    color: #34d399;
  }
  .saga-step.completed .step-label {
    color: #34d399;
  }
  .saga-step.active .step-label {
    color: #60a5fa;
    font-weight: 600;
  }
`;

export const CommerceCheckoutPageView = {
  id: "commerce-checkout-page",
  contractVersion: "1.0.0" as const,
  route: "/commerce/checkout",
  title: "Commerce — checkout",
  ownerApp: "@apps/commerce",
  render(): string {
    return `
      <style>${CommerceStyles}</style>
      <div class="commerce-container" data-testid="commerce-checkout-view">
        <div class="commerce-header">
          <h1>Commerce Storefront & Checkout</h1>
          <p>Explore high-fidelity product offers synchronised with the Portfolio PIM catalog and trigger transaction sagas.</p>
        </div>

        <div class="product-grid">
          <!-- Offer 1 -->
          <div class="product-card">
            <div>
              <span class="product-badge">Portfolio Offer V-001</span>
              <h3 class="product-title">Œuvre Numérique A</h3>
              <p class="product-desc">High-completeness digital artwork license registered in the Portfolio PIM catalog. Includes premium access keys.</p>
            </div>
            <div class="product-footer">
              <span class="product-price">299,00 €</span>
              <button class="buy-btn" onclick="startCheckout('Œuvre Numérique A', 299)">Buy Now</button>
            </div>
          </div>

          <!-- Offer 2 -->
          <div class="product-card">
            <div>
              <span class="product-badge">Portfolio Offer V-002</span>
              <h3 class="product-title">Installation Physique B</h3>
              <p class="product-desc">Physical modern installation artifact curated and tracked inside the Portfolio Bounded Context.</p>
            </div>
            <div class="product-footer">
              <span class="product-price">1 500,00 €</span>
              <button class="buy-btn" onclick="startCheckout('Installation Physique B', 1500)">Buy Now</button>
            </div>
          </div>

          <!-- Offer 3 -->
          <div class="product-card">
            <div>
              <span class="product-badge">Platform Exclusive</span>
              <h3 class="product-title">MosaiX Premium Pro Key</h3>
              <p class="product-desc">Platform-wide executive credentials bundle granting extended capacities across Citadelle and Solidarity networks.</p>
            </div>
            <div class="product-footer">
              <span class="product-price">89,00 €</span>
              <button class="buy-btn" onclick="startCheckout('Premium Pro Key', 89)">Buy Now</button>
            </div>
          </div>
        </div>

        <!-- Saga Console -->
        <div class="saga-container">
          <div class="saga-title">
            <span style="font-size: 1.25rem;">⚡</span>
            <span>Transaction Orchestration: Checkout Saga Console</span>
          </div>
          <div id="saga-log-message" style="font-size: 0.9rem; color: #9ca3af; background: #030712; padding: 12px 16px; border-radius: 8px; border: 1px solid #1f2937; font-family: monospace;">
            Select a product above to start a secure Checkout Order Saga.
          </div>

          <div class="saga-steps">
            <div class="saga-steps-progress" id="saga-bar"></div>
            
            <div class="saga-step" id="step-1">
              <div class="step-circle">1</div>
              <div class="step-label">Created</div>
            </div>
            <div class="saga-step" id="step-2">
              <div class="step-circle">2</div>
              <div class="step-label">Authorized</div>
            </div>
            <div class="saga-step" id="step-3">
              <div class="step-circle">3</div>
              <div class="step-label">Reserved</div>
            </div>
            <div class="saga-step" id="step-4">
              <div class="step-circle">4</div>
              <div class="step-label">Completed</div>
            </div>
          </div>
        </div>
      </div>

      <script>
        function escapeCommerceHtml(str) {
          if (!str) return '';
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        }

        function startCheckout(productName, price) {
          const logEl = document.getElementById('saga-log-message');
          const barEl = document.getElementById('saga-bar');
          
          // Reset steps
          for (let i = 1; i <= 4; i++) {
            const step = document.getElementById('step-' + i);
            step.classList.remove('active', 'completed');
          }
          barEl.style.width = '0%';

          const safeName = escapeCommerceHtml(productName);
          const safePrice = Number.isFinite(Number(price)) ? Number(price).toFixed(2) : '0.00';

          logEl.innerHTML = '> [Saga Initiated] Checkout triggered for "' + safeName + '" (' + safePrice + ' €)...';
          document.getElementById('step-1').classList.add('active');

          setTimeout(() => {
            document.getElementById('step-1').classList.add('completed');
            document.getElementById('step-1').classList.remove('active');
            document.getElementById('step-2').classList.add('active');
            barEl.style.width = '33%';
            logEl.innerHTML += '<br/>> [Payment Services] Authorising credit card transaction for ' + safePrice + ' €... Success.';
          }, 800);

          setTimeout(() => {
            document.getElementById('step-2').classList.add('completed');
            document.getElementById('step-2').classList.remove('active');
            document.getElementById('step-3').classList.add('active');
            barEl.style.width = '66%';
            logEl.innerHTML += '<br/>> [Inventory Services] Verifying stock level for item and locking reservation... Confirmed.';
          }, 1600);

          setTimeout(() => {
            document.getElementById('step-3').classList.add('completed');
            document.getElementById('step-3').classList.remove('active');
            document.getElementById('step-4').classList.add('completed');
            barEl.style.width = '100%';
            logEl.innerHTML += '<br/>> [Saga Completed] Order successfully finalized! Receipt generated.';
          }, 2400);
        }
      </script>
    `;
  },
};

export const commerceNavigationItems = [
  { id: "nav-checkout", label: "Checkout", route: "/commerce/checkout", pageView: CommerceCheckoutPageView },
];

export function registerCommerceAdminPages() {
  return [
    { applicationId: "@apps/commerce", entrypoint: "orders-admin", order: 40, permission: "commerce:order:read" }
  ];
}

export const commerceContributions: ContributionContract[] = [
  {
    id: "commerce:nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/commerce",
    kind: "navigation",
    title: "Commerce",
    route: "/commerce/checkout",
    icon: "🛒",
    placements: [{ id: "p-com-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 30 }],
  },
  {
    id: "commerce:checkout-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/commerce",
    kind: "page",
    title: "Commerce — Checkout Saga",
    route: "/commerce/checkout",
    placements: [{ id: "p-com-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: CommerceCheckoutPageView.render() },
  },
];
