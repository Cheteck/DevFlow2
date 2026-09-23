import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

shellRegistry.registerAdminPage({
  id: "portfolio-pim-admin",
  bacId: "@apps/portfolio",
  title: "Catalogue Portfolio",
  description: "Gestion des vitrines de projets, vendables et publications créatives",
  icon: "palette",
  route: "/portfolio/admin/vendables",
  category: "content",
  permission: "portfolio:admin:manage",
  order: 60,
  badge: { text: "6 Projets", variant: "primary" },
  metrics: [
    { id: "active-projects", label: "Projets Vitrine", value: 6, status: "nominal", icon: "folder_special" },
    { id: "portfolio-views", label: "Vues Globales", value: "8.4k", change: "+24%", status: "nominal", icon: "visibility" }
  ],
  render: () => PortfolioCatalogPageView.render()
});

export const PortfolioStyles = `
  .active-pill {
    background-color: var(--primary-container, #a078ff) !important;
    color: var(--on-primary-container, #340080) !important;
    box-shadow: 0 0 12px rgba(160,120,255,0.3) !important;
  }
`;

export interface PortfolioCatalogItem {
  id: string;
  name: string;
  completeness?: number | undefined;
}

export const PortfolioCatalogPageView = {
  id: "portfolio-catalog-page",
  contractVersion: "1.0.0" as const,
  route: "/portfolio/catalog",
  title: "Portfolio — catalog",
  ownerApp: "@apps/portfolio",
  render(): string {
    return `
      <style>${PortfolioStyles}</style>
      <div class="flex flex-col w-full bg-[#0b1326] min-h-screen text-[#dae2fd] font-sans" style="padding: 24px;">
        <!-- Ambient Glow Orbs -->
        <div class="absolute -top-36 left-1/4 w-96 h-96 bg-[#a078ff]/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div class="absolute top-10 right-1/4 w-80 h-80 bg-[#4f319c]/15 rounded-full blur-[100px] pointer-events-none"></div>

        <!-- Header Section -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 mb-8">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-1.5 text-[#cbc3d7] text-xs font-semibold tracking-wider uppercase">
              <span>Commerce</span>
              <span class="material-symbols-outlined text-[14px]">chevron_right</span>
              <span class="text-[#d0bcff] font-bold">Gestion des Vendables</span>
            </div>
            <div class="flex flex-wrap items-center gap-4 mt-1">
              <h1 class="text-3xl font-extrabold text-[#dae2fd] tracking-tight">Catalogue & Listings Actifs</h1>
              <div class="flex items-center gap-1 px-3 py-1 rounded-full bg-[#2d3449] text-[#d0bcff] text-xs font-bold shadow-sm">
                <span class="w-2 h-2 rounded-full bg-[#d0bcff] animate-pulse shadow-[0_0_8px_rgba(208,188,255,0.9)]"></span>
                <span>64 vendables actifs</span>
              </div>
            </div>
          </div>
          <!-- Action Buttons -->
          <div class="flex items-center gap-2">
            <button class="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#2d3449] hover:bg-[#31394d] text-on-surface font-semibold text-xs transition" id="exportBtn" onclick="exportPortfolioJson()">
              <span class="material-symbols-outlined text-[18px]">download</span>
              <span>Exporter JSON</span>
            </button>
            <button class="flex items-center gap-1 px-5 py-2 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#d0bcff] text-[#340080] font-bold text-xs transition shadow-[0_0_20px_rgba(160,120,255,0.35)]" onclick="openProductModal()">
              <span class="material-symbols-outlined text-[18px]">add_circle</span>
              <span>+ Créer un vendable</span>
            </button>
          </div>
        </div>

        <div id="portfolio-toast-container" class="fixed bottom-5 right-5 z-50 pointer-events-none"></div>

        <!-- Create Product Modal -->
        <div id="newProductModal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div class="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 w-full max-w-md shadow-2xl text-on-surface space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-white">Nouveau Vendable</h3>
              <button onclick="closeProductModal()" class="text-on-surface-variant hover:text-white"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div>
              <label class="block text-xs font-semibold text-on-surface-variant mb-1">Nom de l'offre</label>
              <input id="modalProductName" type="text" placeholder="Ex: Service Consultation Cloud" class="w-full px-3 py-2 rounded-xl bg-[#060e20] border border-[#2d3449] text-xs text-white focus:outline-none focus:border-[#a078ff]" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-on-surface-variant mb-1">Prix unitaire (€)</label>
              <input id="modalProductPrice" type="number" step="0.01" placeholder="99.00" class="w-full px-3 py-2 rounded-xl bg-[#060e20] border border-[#2d3449] text-xs text-white focus:outline-none focus:border-[#a078ff]" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button onclick="closeProductModal()" class="px-4 py-2 rounded-xl bg-[#2d3449] text-xs font-semibold text-on-surface hover:bg-[#31394d]">Annuler</button>
              <button onclick="confirmAddNewProduct()" class="px-4 py-2 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#d0bcff] text-[#340080] text-xs font-bold shadow-md hover:opacity-95">Créer</button>
            </div>
          </div>
        </div>

        <!-- Analytics KPIs -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 relative z-10 mb-8">
          <!-- KPI 1 -->
          <div class="bg-[#131b2e] border border-[#2d3449]/30 rounded-xl p-5 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <span class="text-[11px] font-bold text-[#cbc3d7] uppercase tracking-wider">Total Revenu Vendables</span>
              <span class="material-symbols-outlined text-primary text-[18px]">payments</span>
            </div>
            <div class="flex items-baseline justify-between mt-3">
              <span class="text-2xl font-extrabold text-[#dae2fd]">48,920 €</span>
              <span class="text-xs font-bold text-[#d0bcff] flex items-center gap-0.5">
                <span class="material-symbols-outlined text-[14px]">trending_up</span> +14.2%
              </span>
            </div>
          </div>
          <!-- KPI 2 -->
          <div class="bg-[#131b2e] border border-[#2d3449]/30 rounded-xl p-5 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <span class="text-[11px] font-bold text-[#cbc3d7] uppercase tracking-wider">Volume de Ventes</span>
              <span class="material-symbols-outlined text-secondary text-[18px]">shopping_bag</span>
            </div>
            <div class="flex items-baseline justify-between mt-3">
              <span class="text-2xl font-extrabold text-[#dae2fd]">1,420 <span class="text-xs font-normal text-[#cbc3d7]">unités</span></span>
              <span class="text-xs font-bold text-[#cebdff] flex items-center gap-0.5">
                <span class="material-symbols-outlined text-[14px]">arrow_upward</span> +8.4%
              </span>
            </div>
          </div>
          <!-- KPI 3 -->
          <div class="bg-[#131b2e] border border-[#2d3449]/30 rounded-xl p-5 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <span class="text-[11px] font-bold text-[#cbc3d7] uppercase tracking-wider">Conversion Moyenne</span>
              <span class="material-symbols-outlined text-tertiary text-[18px]">ads_click</span>
            </div>
            <div class="flex items-baseline justify-between mt-3">
              <span class="text-2xl font-extrabold text-[#dae2fd]">3.8%</span>
              <span class="text-xs font-bold text-[#d0bcff] flex items-center gap-0.5">
                <span class="material-symbols-outlined text-[14px]">trending_up</span> +0.4 pts
              </span>
            </div>
          </div>
          <!-- KPI 4 -->
          <div class="bg-[#131b2e] border border-[#2d3449]/30 rounded-xl p-5 flex flex-col justify-between border-l-2 border-l-[#ffb4ab]">
            <div class="flex items-start justify-between">
              <span class="text-[11px] font-bold text-[#cbc3d7] uppercase tracking-wider">Alertes Stock</span>
              <span class="material-symbols-outlined text-[#ffb4ab] text-[18px]">warning</span>
            </div>
            <div class="flex items-baseline justify-between mt-3">
              <span class="text-2xl font-extrabold text-[#ffb4ab]">3 <span class="text-xs font-normal text-[#cbc3d7]">critiques</span></span>
              <span class="px-2 py-0.5 rounded bg-[#93000a] text-[#ffdad6] text-[10px] font-bold">Action</span>
            </div>
          </div>
        </div>

        <!-- Filter & Toolbar -->
        <div class="bg-[#131b2e]/60 border border-[#2d3449]/30 rounded-xl p-4 backdrop-blur-md relative z-10 shadow-sm mb-6 flex flex-col gap-4">
          <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <!-- Search bar -->
            <div class="relative flex items-center flex-1 max-w-lg">
              <span class="material-symbols-outlined absolute left-3 text-[#cbc3d7] text-[18px]">search</span>
              <input class="w-full bg-[#171f33] text-[#dae2fd] placeholder:text-[#cbc3d7]/50 text-sm pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#d0bcff] shadow-inner" id="searchInput" placeholder="Rechercher par titre, SKU, type..." type="text" oninput="applyPimFilters()"/>
            </div>
            <!-- Filter Dropdowns & View Switcher -->
            <div class="flex flex-wrap items-center gap-3">
              <!-- Status -->
              <div class="relative">
                <select class="appearance-none bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] text-xs font-semibold pl-4 pr-8 py-2 rounded-xl focus:outline-none cursor-pointer transition-colors shadow-sm" id="statusFilter" onchange="applyPimFilters()">
                  <option value="all">Tous statuts</option>
                  <option value="online">En ligne</option>
                  <option value="exhausted">Épuisé</option>
                  <option value="draft">Brouillon / Révision</option>
                </select>
                <span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#cbc3d7] pointer-events-none text-[16px]">expand_more</span>
              </div>
              <!-- View Switchers -->
              <div class="flex items-center bg-[#060e20] p-0.5 rounded-xl">
                <button class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2d3449] text-[#d0bcff] shadow-sm text-xs font-bold transition-all" id="btnViewTable">
                  <span class="material-symbols-outlined text-[18px]">table_chart</span>
                  <span>Tableau</span>
                </button>
                <button class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[#cbc3d7] hover:text-[#dae2fd] text-xs font-bold transition-all" id="btnViewGrid">
                  <span class="material-symbols-outlined text-[18px]">grid_view</span>
                  <span>Grille</span>
                </button>
              </div>
            </div>
          </div>
          <!-- Category pills -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button class="filter-pill px-4 py-1 rounded-full bg-[#a078ff] text-[#340080] text-xs font-bold shrink-0 transition-all active-pill" data-type="all" onclick="setPill(this)">
              Tous les vendables (5)
            </button>
            <button class="filter-pill px-4 py-1 rounded-full bg-[#2d3449] hover:bg-[#31394d] text-[#dae2fd] text-xs font-bold shrink-0 transition-all" data-type="product" onclick="setPill(this)">
              Produits Physiques (3)
            </button>
            <button class="filter-pill px-4 py-1 rounded-full bg-[#2d3449] hover:bg-[#31394d] text-[#dae2fd] text-xs font-bold shrink-0 transition-all" data-type="service" onclick="setPill(this)">
              Services & Audits (2)
            </button>
          </div>
        </div>

        <!-- Floating bulk action bar -->
        <div class="hidden flex items-center justify-between bg-[#a078ff] text-[#340080] px-6 py-3 rounded-xl shadow-lg transition-all mb-6" id="bulkActionBar">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
            <span class="font-bold text-sm" id="bulkCountText">0 vendables sélectionnés</span>
          </div>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1 rounded-lg bg-[#060e20]/20 hover:bg-[#060e20]/30 text-xs font-bold" onclick="showPortfolioNotice('Statut des vendables sélectionnés mis à jour.', 'success')">Changer statut</button>
            <button class="p-1 rounded-lg hover:bg-[#060e20]/20" onclick="clearPimSelection()">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <!-- VIEW 1: DATA TABLE -->
        <div class="flex flex-col bg-[#060e20] rounded-xl overflow-hidden shadow-sm border border-[#2d3449]/20" id="viewTableContainer">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-[#171f33] text-[#cbc3d7] text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">
                    <input class="rounded accent-[#d0bcff] w-4 h-4 cursor-pointer" id="selectAllCheckbox" type="checkbox" onchange="toggleSelectAll(this)"/>
                  </th>
                  <th class="py-3 px-4">Vendable / SKU</th>
                  <th class="py-3 px-4">Source</th>
                  <th class="py-3 px-4">Prix unitaire</th>
                  <th class="py-3 px-4">Stock & Dispo</th>
                  <th class="py-3 px-4">Statut</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="text-[#dae2fd]" id="listingsTableBody">
                <!-- Item 1 -->
                <tr class="listing-row border-b border-[#2d3449]/10 hover:bg-[#131b2e]/40 transition-colors" data-sku="V-001" data-status="online" data-title="Œuvre Numérique A" data-type="product">
                  <td class="py-4 px-4 text-center">
                    <input class="row-checkbox rounded accent-[#d0bcff] w-4 h-4 cursor-pointer" type="checkbox" onchange="updateBulkBar()"/>
                  </td>
                  <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-[#171f33] flex items-center justify-center text-lg shadow-inner shrink-0">🎨</div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-bold">Œuvre Numérique A</span>
                          <span class="px-1.5 py-0.2 rounded bg-[#a078ff]/20 text-[#d0bcff] text-[10px] font-bold uppercase">Produit</span>
                        </div>
                        <span class="text-[#cbc3d7] text-xs">SKU: V-001 • High-enrichment digital certificate</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-xs font-semibold text-[#cbc3d7]">Catalog</td>
                  <td class="py-4 px-4 font-bold">299.00 €</td>
                  <td class="py-4 px-4">
                    <div class="flex flex-col gap-1 w-32">
                      <div class="flex justify-between text-[11px] font-semibold text-[#d0bcff]">
                        <span>95% complete</span>
                        <span>Optimum</span>
                      </div>
                      <div class="w-full bg-[#171f33] h-1.5 rounded-full overflow-hidden">
                        <div class="bg-[#d0bcff] h-full rounded-full" style="width: 95%"></div>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131b2e] text-[#cebdff] text-xs font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#d0bcff] shadow-[0_0_6px_rgba(208,188,255,0.8)]"></span>
                      <span>En ligne</span>
                    </span>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <button class="p-1 rounded-lg hover:bg-[#2d3449] text-[#cbc3d7] hover:text-white transition-colors" onclick="showPortfolioNotice('Édition de Œuvre Numérique A (SKU: V-001)', 'info')">
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </td>
                </tr>

                <!-- Item 2 -->
                <tr class="listing-row border-b border-[#2d3449]/10 hover:bg-[#131b2e]/40 transition-colors" data-sku="V-002" data-status="online" data-title="Installation Physique B" data-type="product">
                  <td class="py-4 px-4 text-center">
                    <input class="row-checkbox rounded accent-[#d0bcff] w-4 h-4 cursor-pointer" type="checkbox" onchange="updateBulkBar()"/>
                  </td>
                  <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-[#171f33] flex items-center justify-center text-lg shadow-inner shrink-0">🏛️</div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-bold">Installation Physique B</span>
                          <span class="px-1.5 py-0.2 rounded bg-[#a078ff]/20 text-[#d0bcff] text-[10px] font-bold uppercase">Produit</span>
                        </div>
                        <span class="text-[#cbc3d7] text-xs">SKU: V-002 • Physical modern installation</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-xs font-semibold text-[#cbc3d7]">Catalog</td>
                  <td class="py-4 px-4 font-bold">1 500.00 €</td>
                  <td class="py-4 px-4">
                    <div class="flex flex-col gap-1 w-32">
                      <div class="flex justify-between text-[11px] font-semibold text-[#d0bcff]">
                        <span>80% complete</span>
                        <span>Optimum</span>
                      </div>
                      <div class="w-full bg-[#171f33] h-1.5 rounded-full overflow-hidden">
                        <div class="bg-[#d0bcff] h-full rounded-full" style="width: 80%"></div>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131b2e] text-[#cebdff] text-xs font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#d0bcff] shadow-[0_0_6px_rgba(208,188,255,0.8)]"></span>
                      <span>En ligne</span>
                    </span>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <button class="p-1 rounded-lg hover:bg-[#2d3449] text-[#cbc3d7] hover:text-white transition-colors" onclick="showPortfolioNotice('Édition de Installation Physique B (SKU: V-002)', 'info')">
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </td>
                </tr>

                <!-- Item 3 -->
                <tr class="listing-row border-b border-[#2d3449]/10 hover:bg-[#131b2e]/40 transition-colors" data-sku="V-003" data-status="draft" data-title="Premium Subscription" data-type="service">
                  <td class="py-4 px-4 text-center">
                    <input class="row-checkbox rounded accent-[#d0bcff] w-4 h-4 cursor-pointer" type="checkbox" onchange="updateBulkBar()"/>
                  </td>
                  <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-[#171f33] flex items-center justify-center text-lg shadow-inner shrink-0">🤝</div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-bold">Premium Subscription</span>
                          <span class="px-1.5 py-0.2 rounded bg-[#8e8bc2]/20 text-[#c4c1fb] text-[10px] font-bold uppercase">Service</span>
                        </div>
                        <span class="text-[#cbc3d7] text-xs">SKU: V-003 • Access rules and multi-user benefits</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-xs font-semibold text-[#cbc3d7]">Catalog</td>
                  <td class="py-4 px-4 font-bold">89.00 €</td>
                  <td class="py-4 px-4">
                    <div class="flex flex-col gap-1 w-32">
                      <div class="flex justify-between text-[11px] font-semibold text-[#fbbf24]">
                        <span>45% complete</span>
                        <span>Draft</span>
                      </div>
                      <div class="w-full bg-[#171f33] h-1.5 rounded-full overflow-hidden">
                        <div class="bg-[#fbbf24] h-full rounded-full" style="width: 45%"></div>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131b2e] text-[#fbbf24] text-xs font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#fbbf24] shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>
                      <span>Brouillon</span>
                    </span>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <button class="p-1 rounded-lg hover:bg-[#2d3449] text-[#cbc3d7] hover:text-white transition-colors" onclick="showPortfolioNotice('Édition de Premium Subscription (SKU: V-003)', 'info')">
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- VIEW 2: CARD GRID (Hidden initially) -->
        <div class="hidden grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" id="viewGridContainer">
          <!-- Card 1 -->
          <div class="bg-[#131b2e] border border-[#2d3449]/30 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
            <div class="p-5 flex flex-col gap-3">
              <div class="flex justify-between items-center">
                <span class="px-2 py-0.5 rounded-full bg-[#a078ff]/10 text-[#d0bcff] text-[10px] font-bold">V-001</span>
                <span class="text-xs text-[#cbc3d7] font-semibold">95% complete</span>
              </div>
              <h3 class="text-lg font-bold">Œuvre Numérique A</h3>
              <p class="text-xs text-[#cbc3d7]">High-enrichment digital media certificate, fully integrated with Commerce workflows.</p>
              <div class="w-full bg-[#171f33] h-1 rounded-full overflow-hidden">
                <div class="bg-[#d0bcff] h-full" style="width: 95%"></div>
              </div>
            </div>
            <div class="bg-[#171f33] px-5 py-3 flex items-center justify-between text-xs text-[#cbc3d7]">
              <span class="font-bold text-[#dae2fd]">299.00 €</span>
              <span>Published</span>
            </div>
          </div>

          <!-- Card 2 -->
          <div class="bg-[#131b2e] border border-[#2d3449]/30 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
            <div class="p-5 flex flex-col gap-3">
              <div class="flex justify-between items-center">
                <span class="px-2 py-0.5 rounded-full bg-[#a078ff]/10 text-[#d0bcff] text-[10px] font-bold">V-002</span>
                <span class="text-xs text-[#cbc3d7] font-semibold">80% complete</span>
              </div>
              <h3 class="text-lg font-bold">Installation Physique B</h3>
              <p class="text-xs text-[#cbc3d7]">Physical artifact tracking specifications, shipping criteria, and spatial parameters.</p>
              <div class="w-full bg-[#171f33] h-1 rounded-full overflow-hidden">
                <div class="bg-[#d0bcff] h-full" style="width: 80%"></div>
              </div>
            </div>
            <div class="bg-[#171f33] px-5 py-3 flex items-center justify-between text-xs text-[#cbc3d7]">
              <span class="font-bold text-[#dae2fd]">1 500.00 €</span>
              <span>Published</span>
            </div>
          </div>

          <!-- Card 3 -->
          <div class="bg-[#131b2e] border border-[#2d3449]/30 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
            <div class="p-5 flex flex-col gap-3">
              <div class="flex justify-between items-center">
                <span class="px-2 py-0.5 rounded-full bg-[#a078ff]/10 text-[#d0bcff] text-[10px] font-bold">V-003</span>
                <span class="text-xs text-[#cbc3d7] font-semibold">45% complete</span>
              </div>
              <h3 class="text-lg font-bold">Premium Subscription</h3>
              <p class="text-xs text-[#cbc3d7]">Access rules, multi-user benefits, and Solidarity contributions metrics.</p>
              <div class="w-full bg-[#171f33] h-1 rounded-full overflow-hidden">
                <div class="bg-[#fbbf24] h-full" style="width: 45%"></div>
              </div>
            </div>
            <div class="bg-[#171f33] px-5 py-3 flex items-center justify-between text-xs text-[#cbc3d7]">
              <span class="font-bold text-[#dae2fd]">89.00 €</span>
              <span>Draft</span>
            </div>
          </div>
        </div>

      </div>

      <script>
        // View Toggle handlers
        const pimBtnTable = document.getElementById('btnViewTable');
        const pimBtnGrid = document.getElementById('btnViewGrid');
        const pimTableContainer = document.getElementById('viewTableContainer');
        const pimGridContainer = document.getElementById('viewGridContainer');

        if (pimBtnTable) {
          pimBtnTable.addEventListener('click', () => {
            pimTableContainer.classList.remove('hidden');
            pimGridContainer.classList.add('hidden');
            pimBtnTable.classList.add('bg-[#2d3449]', 'text-[#d0bcff]', 'shadow-sm');
            pimBtnTable.classList.remove('text-[#cbc3d7]');
            pimBtnGrid.classList.remove('bg-[#2d3449]', 'text-[#d0bcff]', 'shadow-sm');
            pimBtnGrid.classList.add('text-[#cbc3d7]');
          });
        }

        if (pimBtnGrid) {
          pimBtnGrid.addEventListener('click', () => {
            pimTableContainer.classList.add('hidden');
            pimGridContainer.classList.remove('hidden');
            pimBtnGrid.classList.add('bg-[#2d3449]', 'text-[#d0bcff]', 'shadow-sm');
            pimBtnGrid.classList.remove('text-[#cbc3d7]');
            pimBtnTable.classList.remove('bg-[#2d3449]', 'text-[#d0bcff]', 'shadow-sm');
            pimBtnTable.classList.add('text-[#cbc3d7]');
          });
        }

        // Pill Switcher
        let activePillType = 'all';
        function setPill(btn) {
          document.querySelectorAll('.filter-pill').forEach(p => {
            p.classList.remove('bg-[#a078ff]', 'text-[#340080]', 'active-pill');
            p.classList.add('bg-[#2d3449]', 'text-[#dae2fd]');
          });
          btn.classList.add('bg-[#a078ff]', 'text-[#340080]', 'active-pill');
          btn.classList.remove('bg-[#2d3449]', 'text-[#dae2fd]');
          activePillType = btn.getAttribute('data-type');
          applyPimFilters();
        }

        // Selection Handlers
        function toggleSelectAll(selectAllCb) {
          document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.checked = selectAllCb.checked;
          });
          updateBulkBar();
        }

        function clearPimSelection() {
          document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
          const selectAll = document.getElementById('selectAllCheckbox');
          if (selectAll) selectAll.checked = false;
          updateBulkBar();
        }

        function updateBulkBar() {
          const checked = document.querySelectorAll('.row-checkbox:checked').length;
          const bulkBar = document.getElementById('bulkActionBar');
          const bulkText = document.getElementById('bulkCountText');
          if (checked > 0) {
            bulkBar.classList.remove('hidden');
            bulkText.textContent = checked + ' vendables sélectionnés';
          } else {
            bulkBar.classList.add('hidden');
          }
        }

        // Filtering
        function applyPimFilters() {
          const query = document.getElementById('searchInput').value.toLowerCase().trim();
          const status = document.getElementById('statusFilter').value;
          const rows = document.querySelectorAll('.listing-row');

          rows.forEach(row => {
            const title = row.getAttribute('data-title').toLowerCase();
            const sku = row.getAttribute('data-sku').toLowerCase();
            const type = row.getAttribute('data-type');
            const rowStatus = row.getAttribute('data-status');

            const matchesQuery = !query || title.includes(query) || sku.includes(query);
            const matchesPill = activePillType === 'all' || type === activePillType;
            const matchesStatus = status === 'all' || rowStatus === status;

            if (matchesQuery && matchesPill && matchesStatus) {
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          });
        }

        window.showPortfolioNotice = window.showPortfolioNotice || function(message, type) {
          let prefix = "";
          if (type === 'error') prefix = "Erreur: ";
          if (type === 'success') prefix = "Succès: ";
          window.alert(prefix + message);
        };

        window.openProductModal = function() {
          const modal = document.getElementById('newProductModal');
          if (modal) {
            modal.classList.remove('hidden');
            const nameInput = document.getElementById('modalProductName');
            if (nameInput) nameInput.focus();
          }
        };

        window.closeProductModal = function() {
          const modal = document.getElementById('newProductModal');
          if (modal) modal.classList.add('hidden');
        };

        window.confirmAddNewProduct = function() {
          const nameInput = document.getElementById('modalProductName');
          const priceInput = document.getElementById('modalProductPrice');
          const name = nameInput ? nameInput.value.trim() : '';
          const price = (priceInput && priceInput.value.trim()) ? parseFloat(priceInput.value).toFixed(2) : '0.00';

          if (!name) {
            showPortfolioNotice('Veuillez spécifier le nom du vendable.', 'error');
            return;
          }

          addNewProductItem(name, price);
          closeProductModal();
          if (nameInput) nameInput.value = '';
          if (priceInput) priceInput.value = '';
          showPortfolioNotice('Vendable "' + name + '" ajouté au catalogue PIM.', 'success');
        };

        window.exportPortfolioJson = function() {
          const rows = Array.from(document.querySelectorAll('.listing-row')).map(r => ({
            sku: r.getAttribute('data-sku'),
            title: r.getAttribute('data-title'),
            status: r.getAttribute('data-status'),
            type: r.getAttribute('data-type')
          }));
          const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'portfolio-vendables.json';
          a.click();
          URL.revokeObjectURL(url);
          showPortfolioNotice('Export JSON généré avec succès !', 'success');
        };

        function addNewProductItem(name, price) {
          const sku = 'V-0' + (document.querySelectorAll('.listing-row').length + 1);

          const table = document.getElementById('listingsTableBody');
          const row = document.createElement('tr');
          row.className = 'listing-row border-b border-[#2d3449]/10 hover:bg-[#131b2e]/40 transition-colors';
          row.setAttribute('data-sku', sku);
          row.setAttribute('data-status', 'online');
          row.setAttribute('data-title', name);
          row.setAttribute('data-type', 'product');

          row.innerHTML = \`
            <td class="py-4 px-4 text-center">
              <input class="row-checkbox rounded accent-[#d0bcff] w-4 h-4 cursor-pointer" type="checkbox" onchange="updateBulkBar()"/>
            </td>
            <td class="py-4 px-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-[#171f33] flex items-center justify-center text-lg shadow-inner shrink-0">📦</div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold item-name"></span>
                    <span class="px-1.5 py-0.2 rounded bg-[#a078ff]/20 text-[#d0bcff] text-[10px] font-bold uppercase">Produit</span>
                  </div>
                  <span class="text-[#cbc3d7] text-xs item-sku"></span>
                </div>
              </div>
            </td>
            <td class="py-4 px-4 text-xs font-semibold text-[#cbc3d7]">Catalog</td>
            <td class="py-4 px-4 font-bold item-price"></td>
            <td class="py-4 px-4">
              <div class="flex flex-col gap-1 w-32">
                <div class="flex justify-between text-[11px] font-semibold text-[#d0bcff]">
                  <span>20% complete</span>
                  <span>Draft</span>
                </div>
                <div class="w-full bg-[#171f33] h-1.5 rounded-full overflow-hidden">
                  <div class="bg-[#d0bcff] h-full" style="width: 20%"></div>
                </div>
              </div>
            </td>
            <td class="py-4 px-4">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131b2e] text-[#cebdff] text-xs font-bold">
                <span class="w-1.5 h-1.5 rounded-full bg-[#d0bcff] shadow-[0_0_6px_rgba(208,188,255,0.8)]"></span>
                <span>En ligne</span>
              </span>
            </td>
            <td class="py-4 px-4 text-right">
              <button class="p-1 rounded-lg hover:bg-[#2d3449] text-[#cbc3d7] hover:text-white transition-colors">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </td>
          \`;
          (row.querySelector('.item-name') as HTMLElement).textContent = name;
          (row.querySelector('.item-sku') as HTMLElement).textContent = \`SKU: \${sku} • Newly created in PIM\`;
          (row.querySelector('.item-price') as HTMLElement).textContent = \`\${price} €\`;

          table.insertBefore(row, table.firstChild);
          applyPimFilters();
        }
      </script>
    `;
  }
};

export const PortfolioPimAdminPageView = {
  id: "portfolio-pim-admin-page",
  contractVersion: "1.0.0" as const,
  route: "/portfolio/admin/vendables",
  title: "Portfolio — PIM Admin",
  ownerApp: "@apps/portfolio",
  render(): string {
    return `
      <style>${PortfolioStyles}</style>
      <div class="portfolio-container" style="max-width: 1000px;">
        <div class="portfolio-header">
          <h2>PIM: Gestion des Vendables</h2>
          <button class="add-btn">+ Ajouter Vendable</button>
        </div>
        <div style="background: #111827; padding: 16px; border-radius: 8px; border: 1px solid #1f2937;">
          <table style="width: 100%; text-align: left; font-size: 0.9rem; color: #f5f5f5;">
            <thead>
              <tr style="border-bottom: 1px solid #374151;">
                <th style="padding: 8px;">ID</th>
                <th style="padding: 8px;">Nom Vendable</th>
                <th style="padding: 8px;">Statut</th>
                <th style="padding: 8px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding: 8px;">V-001</td><td style="padding: 8px;">Œuvre Numérique A</td><td style="padding: 8px;">Publié</td><td style="padding: 8px;"><button>Edit</button> <button>Delete</button></td></tr>
              <tr><td style="padding: 8px;">V-002</td><td style="padding: 8px;">Installation Physique B</td><td style="padding: 8px;">Publié</td><td style="padding: 8px;"><button>Edit</button> <button>Delete</button></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
};

export const portfolioNavigationItems = [
  { id: "nav-catalog", label: "Catalog", route: "/portfolio/catalog", pageView: PortfolioCatalogPageView },
];

export const portfolioContributions: ContributionContract[] = [
  {
    id: "portfolio:nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/portfolio",
    kind: "navigation",
    title: "Portfolio",
    route: "/portfolio/catalog",
    icon: "📦",
    placements: [{ id: "p-fol-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 20 }],
  },
  {
    id: "portfolio:catalog-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/portfolio",
    kind: "page",
    title: "Portfolio — Vendable Catalog",
    route: "/portfolio/catalog",
    placements: [{ id: "p-fol-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: {
      render: () => PortfolioCatalogPageView.render()
    },
  },
];
