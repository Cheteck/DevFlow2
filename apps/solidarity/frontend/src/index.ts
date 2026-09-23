import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

export const SolidarityAdminPageView = {
  id: "solidarity-admin-funds-page",
  render(): string {
    return `
      <div class="space-y-6">
        <div id="solidarity-toast-container" class="fixed bottom-5 right-5 z-50 pointer-events-none"></div>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-on-surface">Console d'Entraide & Fonds de Solidarité</h3>
            <p class="text-xs text-on-surface-variant">Validation des campagnes d'urgence communautaires et redistribution des micro-dons.</p>
          </div>
          <button onclick="showSolidarityNotice('Campagne de solidarité validée avec succès !', 'success')" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition">
            <span class="material-symbols-outlined text-sm">favorite</span> Nouveau Fonds
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-on-surface">Caisse Urgence Climat</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">ACTIF</span>
            </div>
            <p class="text-[11px] text-on-surface-variant">Collecte d'urgence pour secours de proximité.</p>
            <div class="flex justify-between items-center text-xs font-bold pt-2 border-t border-outline-variant/10">
              <span class="text-on-surface-variant">Fonds collectés :</span>
              <span class="text-emerald-400">4 850 € / 5 000 € (97%)</span>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-on-surface">Bourse Matériel Numérique</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30">EN COURS</span>
            </div>
            <p class="text-[11px] text-on-surface-variant">Financement d'ordinateurs reconditionnés pour étudiants.</p>
            <div class="flex justify-between items-center text-xs font-bold pt-2 border-t border-outline-variant/10">
              <span class="text-on-surface-variant">Fonds collectés :</span>
              <span class="text-primary">1 200 € / 2 500 € (48%)</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

shellRegistry.registerAdminPage({
  id: "solidarity-admin-funds",
  bacId: "@apps/solidarity",
  title: "Fonds Solidarité",
  description: "Validation des campagnes d'urgence communautaires et redistribution des micro-dons",
  icon: "volunteer_activism",
  route: "/solidarity/admin/funds",
  category: "operations",
  order: 80,
  badge: { text: "2 Caisses", variant: "success" },
  metrics: [
    { id: "total-funds", label: "Fonds Mobilisés", value: "6 050 €", change: "+15%", status: "nominal", icon: "savings" },
    { id: "active-campaigns", label: "Campagnes Actives", value: 2, status: "nominal", icon: "campaign" }
  ],
  render: () => SolidarityAdminPageView.render()
});

export const solidarityUiSlots = [
  {
    slotId: 'space.header.action',
    appId: '@apps/solidarity',
    label: 'IJIDeals Solidarity',
    path: '/solidarity'
  },
  {
    slotId: 'space.dashboard.widget',
    appId: '@apps/solidarity',
    label: 'Solidarity Dashboard',
    path: '/solidarity/dashboard'
  }
];

export const SolidarityStyles = `
  .solidarity-container {
    max-width: 1100px;
    margin: 0 auto;
    font-family: system-ui, -apple-system, sans-serif;
    color: #f3f4f6;
    padding: 24px;
  }
  .solidarity-header {
    margin-bottom: 32px;
  }
  .solidarity-header h1 {
    font-size: 2rem;
    font-weight: 800;
    color: #f9fafb;
    margin-bottom: 8px;
  }
  .solidarity-header p {
    font-size: 0.95rem;
    color: #9ca3af;
  }
  .solidarity-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 32px;
  }
  @media (max-width: 768px) {
    .solidarity-grid {
      grid-template-columns: 1fr;
    }
  }
  .alert-form-panel {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    padding: 24px;
    height: fit-content;
  }
  .alert-form-title {
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 20px;
    color: #f9fafb;
  }
  .form-group {
    margin-bottom: 16px;
  }
  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: #9ca3af;
    margin-bottom: 6px;
  }
  .form-group select, .form-group input, .form-group textarea {
    width: 100%;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 10px 12px;
    color: white;
    font-size: 0.9rem;
    outline: none;
  }
  .form-group select:focus, .form-group input:focus, .form-group textarea:focus {
    border-color: #ef4444;
  }
  .report-btn {
    width: 100%;
    background: #dc2626;
    color: white;
    font-weight: 700;
    font-size: 0.9rem;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
  }
  .report-btn:hover {
    background: #b91c1c;
  }
  .incidents-panel {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    padding: 24px;
  }
  .incidents-title {
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 20px;
    color: #f9fafb;
  }
  .incidents-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .incident-card {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .incident-severity {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .severity-high {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }
  .severity-medium {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }
  .incident-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f9fafb;
    margin: 4px 0;
  }
  .incident-meta {
    font-size: 0.75rem;
    color: #9ca3af;
  }
  .incident-status {
    background: #065f46;
    color: #34d399;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 9999px;
  }
`;

export const SolidarityPageView = {
  id: "solidarity-page",
  contractVersion: "1.0.0" as const,
  route: "/solidarity",
  title: "Solidarity — crisis",
  ownerApp: "@apps/solidarity",
  render(): string {
    return `
      <style>${SolidarityStyles}</style>
      <div class="solidarity-container" data-testid="solidarity-view">
        <div class="solidarity-header">
          <h1>Solidarity Hub & Crisis Response</h1>
          <p>Organize mutual aid, dispatch food resources, coordinate shelters, and report emergencies dynamically.</p>
        </div>

        <div class="solidarity-grid">
          <!-- Left: Report Incident Form -->
          <div class="alert-form-panel">
            <h3 class="alert-form-title">🚨 Report Emergency Alert</h3>
            <div class="form-group">
              <label>Alert Title</label>
              <input type="text" id="sol-title" placeholder="e.g. Broken Water Pipe, Power Outage" />
            </div>
            <div class="form-group">
              <label>Severity Level</label>
              <select id="sol-severity">
                <option value="high">High Emergency</option>
                <option value="medium">Medium Urgency</option>
              </select>
            </div>
            <div class="form-group">
              <label>Location Area</label>
              <input type="text" id="sol-location" placeholder="e.g. District 9, Central Sector" />
            </div>
            <button class="report-btn" onclick="submitAlert()">Dispatch Mutual Aid</button>
          </div>

          <!-- Right: Live Coordination Board -->
          <div class="incidents-panel">
            <h3 class="incidents-title">📡 Active Coordination Board</h3>
            <div class="incidents-list" id="incidents-list">
              <!-- Incident 1 -->
              <div class="incident-card">
                <div>
                  <span class="incident-severity severity-high">High Emergency</span>
                  <h4 class="incident-title">Community Power Outage</h4>
                  <div class="incident-meta">Location: District 9 | Reported: 10m ago</div>
                </div>
                <span class="incident-status">Dispatched</span>
              </div>

              <!-- Incident 2 -->
              <div class="incident-card">
                <div>
                  <span class="incident-severity severity-medium">Medium Urgency</span>
                  <h4 class="incident-title">Food Supply Shortage</h4>
                  <div class="incident-meta">Location: Shelter 3 | Reported: 1h ago</div>
                </div>
                <span class="incident-status" style="background: #1e3a8a; color: #93c5fd;">Active Match</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <script>
        window.showSolidarityNotice = window.showSolidarityNotice || function(message, type) {
          let prefix = "";
          if (type === 'error') prefix = "Erreur: ";
          if (type === 'success') prefix = "Succès: ";
          window.alert(prefix + message);
        };

        function submitAlert() {
          const title = document.getElementById('sol-title').value;
          const severity = document.getElementById('sol-severity').value;
          const location = document.getElementById('sol-location').value;

          if (!title || !location) {
            showSolidarityNotice("Veuillez renseigner tous les détails de l'alerte.", 'error');
            return;
          }

          const list = document.getElementById('incidents-list');
          const card = document.createElement('div');
          card.className = 'incident-card';

          const severityClass = severity === 'high' ? 'severity-high' : 'severity-medium';
          const severityLabel = severity === 'high' ? 'High Emergency' : 'Medium Urgency';

          card.innerHTML = \`
            <div>
              <span class="incident-severity \${severityClass}">\${severityLabel}</span>
              <h4 class="incident-title"></h4>
              <div class="incident-meta">Location: <span class="incident-loc"></span> | Reported: Just now</div>
            </div>
            <span class="incident-status" style="background: #4b5563; color: #d1d5db;">Pending</span>
          \`;
          card.querySelector('.incident-title').textContent = title;
          card.querySelector('.incident-loc').textContent = location;

          list.insertBefore(card, list.firstChild);

          // Clear form
          document.getElementById('sol-title').value = '';
          document.getElementById('sol-location').value = '';

          // Trigger simulated status change
          setTimeout(() => {
            const statusBadge = card.querySelector('.incident-status');
            statusBadge.style.background = '#065f46';
            statusBadge.style.color = '#34d399';
            statusBadge.textContent = 'Dispatched';
          }, 2500);
        }
      </script>
    `;
  }
};

export const solidarityContributions: ContributionContract[] = [
  {
    id: "solidarity:nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/solidarity",
    kind: "navigation",
    title: "Solidarity",
    route: "/solidarity",
    icon: "🤝",
    placements: [
      {
        id: "p-sol-nav",
        surfaceId: "application-shell",
        slotId: "shell.primary-sidebar",
        order: 50,
      },
    ],
  },
  {
    id: "solidarity:page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/solidarity",
    kind: "page",
    title: "Solidarity — Crisis Coordination",
    route: "/solidarity",
    placements: [
      {
        id: "p-sol-page",
        surfaceId: "application-shell",
        slotId: "main.content",
      },
    ],
    content: {
      html: SolidarityPageView.render(),
    },
  },
  {
    id: "solidarity:header-action",
    contractVersion: "1.0.0",
    ownerApp: "@apps/solidarity",
    kind: "action",
    title: "IJIDeals Solidarity",
    route: "/solidarity",
    placements: [
      {
        id: "p-sol-action",
        surfaceId: "space.dashboard",
        slotId: "space.header.action",
      },
    ],
  },
  {
    id: "solidarity:widget",
    contractVersion: "1.0.0",
    ownerApp: "@apps/solidarity",
    kind: "widget",
    title: "Solidarity Dashboard",
    route: "/solidarity/dashboard",
    placements: [
      {
        id: "p-sol-widget",
        surfaceId: "space.dashboard",
        slotId: "space.dashboard.widget",
      },
    ],
    content: {
      html: `<div class="solidarity-widget"><h4>Crisis Alert Network</h4><p>Active mutual aid requests nearby.</p></div>`,
    },
  },
];
