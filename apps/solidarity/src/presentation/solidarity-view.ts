/**
 * @apps/solidarity — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Solidarity (Humanitarian Campaigns & OCHA Reports).
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";

export function createSolidarityDescriptor(): BacDescriptor {
  const CAMPAIGNS = [
    { id: "sld-001", name: "Aide Alimentaire Jijel-Est", type: "Distribution", target: "100 kits", current: "82", progress: "82%", location: "Wilaya de Jijel", status: "Active" },
    { id: "sld-002", name: "Mission Médicale Montagneuse", type: "Medical", target: "5 interventions", current: "3", progress: "60%", location: "Miliana, Ain Defla", status: "Active" },
    { id: "sld-003", name: "Soutien Scolaire Post-Inondation", type: "Education", target: "20 classes", current: "20", progress: "100%", location: "Alger Centre", status: "Completed" }
  ];

  return {
    id: "@apps/solidarity",
    name: "Solidarity",
    version: "1.0.0",
    routePrefix: "/solidarity",
    icon: "🤝",
    isEnabled: true,
    requiredPermissions: ["solidarity:campaign:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const view = context.request.query.view || "list";
      const user = context.user;
      const isAdmin = user.roles?.includes("admin") || user.id === "admin";

      let innerViewHtml: string;
      if (view === "reports") {
        innerViewHtml = `
          <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Rapports d'impact humanitaire (Norme OCHA / HXL)</h3>
            <p class="text-[11px] text-on-surface-variant">Générez et téléchargez des rapports au format HXL (Humanitarian Exchange Language) pour l'intégration avec le Bureau de la coordination des affaires humanitaires.</p>
            
            <div class="space-y-3">
              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center justify-between text-xs">
                <div>
                  <h4 class="font-bold">Rapport OCHA - T3 2026</h4>
                  <p class="text-[10px] text-on-surface-variant">Dernière mise à jour : il y a 2 heures</p>
                </div>
                <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Export du rapport HXL lance !'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-[10px] cursor-pointer">Exporter HXL</button>
              </div>
            </div>
          </div>
        `;
      } else {
        const cardsHtml = CAMPAIGNS.map(c => `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
            <div class="space-y-3">
              <div class="flex justify-between items-start text-[10px]">
                <span class="text-primary font-semibold uppercase tracking-wider">
                  ${escapeHtml(c.type)}
                </span>
                <span class="font-bold uppercase tracking-wider ${
                  c.status === 'Active' ? 'text-emerald-400' : 'text-on-surface-variant/60'
                }">
                  ${escapeHtml(c.status)}
                </span>
              </div>
              <div>
                <h3 class="text-xs font-bold text-on-surface mt-1">${escapeHtml(c.name)}</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5">Lieu : ${escapeHtml(c.location)}</p>
                
                <div class="mt-4 space-y-1.5">
                  <div class="flex justify-between text-[9px] text-on-surface-variant font-mono tabular-nums">
                    <span>Progression :</span>
                    <span class="font-bold text-on-surface">${c.progress} (${c.current} / ${c.target})</span>
                  </div>
                  <div class="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden border border-outline-variant/10">
                    <div class="bg-primary h-full rounded-full transition-all duration-300" style="width: ${c.progress}"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="pt-4 mt-4 border-t border-outline-variant/10">
              <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Merci pour votre interet !'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="w-full py-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-[10px] font-bold text-on-surface transition cursor-pointer">
                Faire un don / Rejoindre
              </button>
            </div>
          </div>
        `).join("");

        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Campagnes Humanitaires Actives</h2>
              ${isAdmin ? `
                <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Nouvelle campagne initialisee'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1 cursor-pointer">
                  <span class="material-symbols-outlined text-sm">add_circle</span>
                  <span>Créer Campagne</span>
                </button>
              ` : ""}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              ${cardsHtml}
            </div>
          </div>
        `;
      }

      const contentHtml = `
        <div class="space-y-6">
          
          <!-- Subnavigation Bar -->
          <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">🤝</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Solidarity Hub</h1>
                <p class="text-[11px] text-on-surface-variant">Suivi des campagnes d'aide humanitaire, missions, logistique et conformité OCHA</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/solidarity?view=list" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'list' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Campagnes d'Aide
              </a>
              <a href="/solidarity?view=reports" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'reports' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Rapports OCHA / HXL
              </a>
            </div>
          </div>

          <!-- Active tab content rendering -->
          ${innerViewHtml}

        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Solidarity — Aide Humanitaire & Crises",
      };
    },
  };
}
