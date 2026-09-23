import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

export const SpacesAdminPageView = {
  id: "spaces-admin-quotas-page",
  render(): string {
    return `
      <div class="space-y-6">
        <div id="spaces-toast-container" class="fixed bottom-5 right-5 z-50 pointer-events-none"></div>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-on-surface">Gestion des Espaces & Quotas de Stockage</h3>
            <p class="text-xs text-on-surface-variant">Attribution des volumes de disques et affectation des gestionnaires par organisation.</p>
          </div>
          <button onclick="showSpacesNotice('Audit des quotas stockage terminé ! 5/5 conformes.', 'success')" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition">
            <span class="material-symbols-outlined text-sm">storage</span> Recalculer Quotas
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 flex flex-col justify-between">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-xs">BA</span>
                <div>
                  <h4 class="font-bold text-xs text-on-surface">Bijoux Amel Space</h4>
                  <p class="text-[10px] text-on-surface-variant">Organisation Commerciale</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">Actif</span>
            </div>
            <div class="space-y-1.5">
              <div class="flex justify-between text-[11px]">
                <span class="text-on-surface-variant">Quota Disque :</span>
                <span class="font-bold text-on-surface">3.8 GB / 10 GB (38%)</span>
              </div>
              <div class="w-full bg-surface-variant/40 rounded-full h-1.5 overflow-hidden">
                <div class="bg-emerald-500 h-1.5 rounded-full" style="width: 38%"></div>
              </div>
            </div>
            <div class="mt-3 pt-3 border-t border-outline-variant/10 flex justify-end">
              <button onclick="adjustSpaceQuota('Bijoux Amel Space')" class="px-2.5 py-1 rounded-lg bg-surface-variant/30 hover:bg-surface-variant/50 text-[11px] text-primary font-semibold transition">
                Modifier Quota
              </button>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 flex flex-col justify-between">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center text-xs">SM</span>
                <div>
                  <h4 class="font-bold text-xs text-on-surface">Sénat Imperial Space</h4>
                  <p class="text-[10px] text-on-surface-variant">Organisation Gouvernance</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">Système</span>
            </div>
            <div class="space-y-1.5">
              <div class="flex justify-between text-[11px]">
                <span class="text-on-surface-variant">Quota Disque :</span>
                <span class="font-bold text-on-surface">10.4 GB / 50 GB (21%)</span>
              </div>
              <div class="w-full bg-surface-variant/40 rounded-full h-1.5 overflow-hidden">
                <div class="bg-blue-500 h-1.5 rounded-full" style="width: 21%"></div>
              </div>
            </div>
            <div class="mt-3 pt-3 border-t border-outline-variant/10 flex justify-end">
              <button onclick="adjustSpaceQuota('Sénat Imperial Space')" class="px-2.5 py-1 rounded-lg bg-surface-variant/30 hover:bg-surface-variant/50 text-[11px] text-primary font-semibold transition">
                Modifier Quota
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

shellRegistry.registerAdminPage({
  id: "spaces-admin-quotas",
  bacId: "@apps/spaces",
  title: "Espaces & Quotas",
  description: "Supervision du stockage partagé, quotas disque et gestionnaires d'espace",
  icon: "folder_open",
  route: "/spaces/admin/quotas",
  category: "infrastructure",
  order: 40,
  badge: { text: "5 Espaces", variant: "success" },
  metrics: [
    { id: "total-spaces", label: "Espaces Actifs", value: 5, status: "nominal", icon: "cloud" },
    { id: "storage-used", label: "Stockage Consommé", value: "14.2 GB", status: "nominal", icon: "storage" }
  ],
  render: () => SpacesAdminPageView.render()
});

export const SpacesStyles = `
  .spaces-container {
    max-width: 1100px;
    margin: 0 auto;
    font-family: system-ui, -apple-system, sans-serif;
    color: #f3f4f6;
    padding: 24px;
  }
  .space-hero-card {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
  }
  .space-hero-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .space-avatar-lg {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, #10b981, #059669);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1.5rem;
  }
  .space-hero-info h2 {
    font-size: 1.4rem;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }
  .space-hero-info p {
    font-size: 0.85rem;
    color: #9ca3af;
    margin: 4px 0 0 0;
  }
  .space-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.2);
    margin-top: 6px;
  }
  .switch-btn {
    background: transparent;
    border: 1px solid #374151;
    color: #d1d5db;
    font-weight: 600;
    font-size: 0.85rem;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .switch-btn:hover {
    background: #1f2937;
    border-color: #4b5563;
  }
  .spaces-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
  }
  .space-card {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    padding: 20px;
    transition: border-color 0.2s;
  }
  .space-card:hover {
    border-color: #10b981;
  }
  .space-card h3 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #f9fafb;
    margin-bottom: 8px;
  }
  .space-card p {
    font-size: 0.85rem;
    color: #9ca3af;
    margin-bottom: 16px;
    line-height: 1.4;
  }
  .collab-list {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .collab-avatar {
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    background: #374151;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: bold;
    border: 2px solid #111827;
  }
`;

export const SpaceDashboardPageView = {
  id: "spaces-dashboard-page",
  contractVersion: "1.0.0" as const,
  route: "/spaces/dashboard",
  title: "Spaces — presence",
  ownerApp: "@apps/spaces",
  render(): string {
    return `
      <style>${SpacesStyles}</style>
      <div class="spaces-container" data-testid="spaces-dashboard-view">
        <div class="space-hero-card">
          <div class="space-hero-info">
            <div class="space-avatar-lg" id="space-avatar">BA</div>
            <div>
              <h2 id="space-name">Bijoux Amel Space</h2>
              <p>Active Space Context · @bijoux-amel</p>
              <span class="space-badge">Verified Organizational Space</span>
            </div>
          </div>
          <button class="switch-btn" onclick="toggleActiveSpace()">Toggle Active Space</button>
        </div>

        <div class="spaces-grid">
          <!-- Card 1 -->
          <div class="space-card">
            <h3>📂 Shared Documents</h3>
            <p>Collaborative project specifications, legal contracts, and Solidarity emergency action plans stored in the space.</p>
            <div style="font-size: 0.75rem; color: #9ca3af; display: flex; justify-content: space-between;">
              <span>32 Files</span>
              <span>1.2 GB utilized</span>
            </div>
          </div>

          <!-- Card 2 -->
          <div class="space-card">
            <h3>👥 Workspace Members</h3>
            <p>Active members ununified and synchronized with the Citadelle security registry.</p>
            <div class="collab-list">
              <div class="collab-avatar" style="background: #3b82f6;">SA</div>
              <div class="collab-avatar" style="background: #10b981;">JD</div>
              <div class="collab-avatar" style="background: #ec4899;">MK</div>
              <div class="collab-avatar" style="background: #4b5563;">+4</div>
            </div>
          </div>

          <!-- Card 3 -->
          <div class="space-card">
            <h3>⚙️ Space Configuration</h3>
            <p>Manage routing prefixes, tenant policies, and ECHoS subscription keys for external micro-services.</p>
            <button class="switch-btn" style="width: 100%; margin-top: 8px; font-size: 0.75rem;" onclick="showSpacesNotice(&quot;Configuration de l'espace prête pour édition.&quot;, 'info')">Edit Configuration</button>
          </div>
        </div>
      </div>

      <script>
        window.showSpacesNotice = window.showSpacesNotice || function(message, type) {
          let prefix = "";
          if (type === 'error') prefix = "Erreur: ";
          if (type === 'success') prefix = "Succès: ";
          window.alert(prefix + message);
        };

        let isAltSpace = false;
        function toggleActiveSpace() {
          const avatar = document.getElementById('space-avatar');
          const name = document.getElementById('space-name');
          
          isAltSpace = !isAltSpace;
          if (isAltSpace) {
            avatar.textContent = 'SM';
            avatar.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
            name.textContent = 'Sénat Imperial Space';
          } else {
            avatar.textContent = 'BA';
            avatar.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            name.textContent = 'Bijoux Amel Space';
          }
        }
      </script>
    `;
  },
};

export const spacesNavigationItems = [
  { id: "nav-spaces", label: "Spaces", route: "/spaces/dashboard", pageView: SpaceDashboardPageView },
];

export function registerSpacesAdminPages() {
  return [
    { applicationId: "@apps/spaces", entrypoint: "space-management", order: 30, permission: "spaces:space:manage" }
  ];
}

export const spacesContributions: ContributionContract[] = [
  {
    id: "spaces:nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/spaces",
    kind: "navigation",
    title: "Spaces",
    route: "/spaces/dashboard",
    icon: "🏢",
    placements: [{ id: "p-spc-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 10 }],
  },
  {
    id: "spaces:dashboard-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/spaces",
    kind: "page",
    title: "Spaces — Organizational Presence",
    route: "/spaces/dashboard",
    placements: [{ id: "p-spc-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: SpaceDashboardPageView.render() },
  },
];
