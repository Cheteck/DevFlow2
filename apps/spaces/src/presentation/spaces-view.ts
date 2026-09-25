/**
 * @apps/spaces — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Spaces & Multi-tenancy (inspired by Facebook/LinkedIn Organization Pages).
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";

export function createSpacesDescriptor(): BacDescriptor {
  const SPACES = [
    { id: "spc-01", name: "Chambre d'Agriculture de Jijel (CAJ)", code: "CAJ-JIJEL", members: 18, plan: "Enterprise", status: "Verified" },
    { id: "spc-02", name: "Espace Solara Lab", code: "SOLARA-LAB", members: 42, plan: "Pro", status: "Verified" },
    { id: "spc-03", name: "Boutique Bijoux Amel", code: "BIJOUX-AMEL", members: 3, plan: "Free Starter", status: "Verified" },
    { id: "spc-04", name: "Tech Startup Hub", code: "TECH-HUB", members: 7, plan: "Pro", status: "Pending" }
  ];

  const MEMBERS = [
    { name: "Lord Cheteck", email: "lord.cheteck@gmail.com", role: "Propriétaire de l'Espace", avatar: "👤" },
    { name: "Amel", email: "amel@mosaix.io", role: "Designer d'Interface", avatar: "💎" },
    { name: "Ali", email: "ali@mosaix.io", role: "Développeur Principal", avatar: "💻" },
    { name: "Sarah Connor", email: "s.connor@citadelle.io", role: "Administrateur Support", avatar: "🛡️" }
  ];

  const APPS_CONNECTED = [
    { name: "Solara Social", desc: "Discussion communautaire & fil d'actualité actif.", icon: "☀️" },
    { name: "Commerce Marketplace", desc: "Marché d'achat direct et gestion de paniers connectée.", icon: "🛒" },
    { name: "Booking Calendar", desc: "Planification des créneaux horaires de l'espace.", icon: "📅" }
  ];

  return {
    id: "@apps/spaces",
    name: "Spaces Hub",
    version: "1.1.0",
    routePrefix: "/spaces",
    icon: "📁",
    isEnabled: true,
    requiredPermissions: ["spaces:space:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const view = context.request.query.view || "list";

      let subViewHtml: string;
      if (view === "new") {
        subViewHtml = `
          <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 max-w-xl mx-auto space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Créer un Nouvel Espace</h3>
            <p class="text-[11px] text-on-surface-variant leading-relaxed">Les espaces vous permettent d'isoler vos catalogues de produits, vos membres, vos ventes et vos analyses.</p>
            
            <form id="create-space-form" onsubmit="event.preventDefault(); const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Espace cree avec succes !'; document.body.appendChild(t); setTimeout(()=>window.location.href='/spaces',2000);" class="space-y-4 text-xs">
              <div>
                <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Nom de l'espace / Organisation</label>
                <input type="text" placeholder="Ex: École Supérieure d'Informatique" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" required />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Code Unique / Identifiant URL</label>
                <input type="text" placeholder="Ex: esi-alger" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition" required />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Forfait d'abonnement</label>
                <select class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition">
                  <option value="free">Free Starter (0.00 € / mois)</option>
                  <option value="pro">Pro (29.00 € / mois)</option>
                  <option value="enterprise">Enterprise (Sur devis)</option>
                </select>
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <a href="/spaces" class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 font-bold">Annuler</a>
                <button type="submit" class="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold shadow-md shadow-primary/25 cursor-pointer">Créer l'Espace</button>
              </div>
            </form>
          </div>
        `;
      } else if (view === "profile") {
        // --- SPACE PROFILE VIEW (Facebook / LinkedIn Org Page style) ---
        subViewHtml = `
          <div class="space-y-6">
            <!-- Space Cover Image Header -->
            <div class="glass-card rounded-2xl border border-outline-variant/20 overflow-hidden bg-surface-container-low/40 relative">
              <!-- Cover Area -->
              <div class="h-44 md:h-56 relative overflow-hidden">
                <img src="/src/assets/images/spaces_workspace_cover_1790307907795.jpg" alt="Espace de travail" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
              </div>

              <!-- Org Superposed Info -->
              <div class="p-6 pt-0 flex flex-col md:flex-row items-center md:items-end justify-between -mt-12 md:-mt-16 relative z-10 gap-4">
                <div class="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
                  <div class="w-24 h-24 rounded-2xl overflow-hidden border-4 border-surface bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary shadow-xl shrink-0">
                    🔬
                  </div>
                  <div class="space-y-1 pb-1">
                    <h2 class="text-lg font-bold text-on-surface flex items-center justify-center md:justify-start gap-1.5">
                      <span>Espace Solara Lab</span>
                      <span class="material-symbols-outlined text-sm text-primary" title="Organisation certifiée">verified</span>
                    </h2>
                    <p class="text-xs text-on-surface-variant font-normal">Identifiant unique : <strong class="font-mono text-primary">SOLARA-LAB</strong></p>
                    <p class="text-[10px] text-on-surface-variant/85 mt-0.5">Wilaya de Jijel, Algérie · Forfait Pro</p>
                  </div>
                </div>

                <!-- Org Actions -->
                <div class="flex items-center gap-2 pb-1">
                  <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Invitation generee !'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold transition hover:opacity-95 shadow-md shadow-primary/20 flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-sm">person_add</span>
                    <span>Inviter membre</span>
                  </button>
                  <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Parametres charges'; document.body.appendChild(t); setTimeout(()=>t.remove(),2000);" class="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-xs font-bold text-on-surface transition cursor-pointer flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">settings</span>
                    <span>Gérer l'Espace</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Profile Content Split columns -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <!-- Left: Description, Space Status, Connected Apps -->
              <div class="lg:col-span-8 space-y-6">
                <!-- Description Box -->
                <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">À propos de l'Espace</h3>
                  <p class="text-xs text-on-surface-variant leading-relaxed">Le Solara Lab est un incubateur d'idées citoyennes et un laboratoire collaboratif pour développer les fonctionnalités souveraines de la plateforme décentralisée MosaiX. Cet espace centralise les efforts de développement, d'ateliers et de commercialisation pour la région de Jijel.</p>
                </div>

                <!-- Connected Apps list -->
                <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Outils & Applications Activés</h3>
                  <div class="space-y-3">
                    ${APPS_CONNECTED.map(app => `
                      <div class="p-3.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 flex items-center gap-3.5 hover:border-primary/20 transition duration-200">
                        <div class="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-lg shadow-inner shrink-0">${app.icon}</div>
                        <div class="flex-1 min-w-0">
                          <h4 class="text-xs font-bold text-on-surface truncate">${escapeHtml(app.name)}</h4>
                          <p class="text-[11px] text-on-surface-variant truncate mt-0.5">${escapeHtml(app.desc)}</p>
                        </div>
                        <span class="text-[9px] font-bold text-emerald-400 uppercase shrink-0">Actif</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              </div>

              <!-- Right: Space Directory & Quick stats -->
              <div class="lg:col-span-4 space-y-6">
                <!-- Directory Box -->
                <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                  <div class="flex justify-between items-center">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Annuaire des Membres</h3>
                    <span class="text-[10px] text-primary font-bold font-mono tabular-nums">${MEMBERS.length} actifs</span>
                  </div>
                  <div class="space-y-3 pt-1">
                    ${MEMBERS.map(m => `
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/15 flex items-center justify-center text-sm shadow-inner shrink-0">${m.avatar}</div>
                        <div class="flex-1 min-w-0">
                          <h4 class="text-xs font-semibold text-on-surface truncate">${escapeHtml(m.name)}</h4>
                          <p class="text-[10px] text-on-surface-variant truncate">${escapeHtml(m.role)}</p>
                        </div>
                      </div>
                    `).join("")}
                  </div>
                </div>

                <!-- Active Space Analytics -->
                <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Indicateurs d'Activité</h3>
                  <div class="grid grid-cols-2 gap-3.5 text-center">
                    <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/10 flex flex-col gap-0.5">
                      <span class="text-[9px] font-bold uppercase text-on-surface-variant">Publications</span>
                      <span class="text-base font-bold text-primary font-mono tabular-nums">142</span>
                    </div>
                    <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/10 flex flex-col gap-0.5">
                      <span class="text-[9px] font-bold uppercase text-on-surface-variant">Réservations</span>
                      <span class="text-base font-bold text-primary font-mono tabular-nums">78%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // Standard view: list spaces
        const cardsHtml = SPACES.map(s => `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
            <div class="space-y-3">
              <div class="flex justify-between items-start text-[10px]">
                <span class="text-primary font-bold uppercase tracking-wider">
                  ${escapeHtml(s.plan)}
                </span>
                <span class="font-bold uppercase tracking-wider ${
                  s.status === 'Verified' ? 'text-emerald-400' : 'text-amber-400'
                }">
                  ${escapeHtml(s.status)}
                </span>
              </div>
              <div>
                <h3 class="text-xs font-bold text-on-surface mt-1">${escapeHtml(s.name)}</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5 font-mono">Code : ${escapeHtml(s.code)}</p>
                <span class="text-[11px] text-on-surface-variant mt-2 block font-mono tabular-nums"><strong class="text-on-surface font-bold font-sans">${s.members}</strong> membres inscrits</span>
              </div>
            </div>
            <div class="pt-4 mt-4 border-t border-outline-variant/10">
              <button onclick="document.cookie = 'mosaix_active_space=${escapeHtml(s.code)}; path=/'; const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Espace actif modifie : ${escapeHtml(s.code)}'; document.body.appendChild(t); setTimeout(()=>window.location.reload(), 1500);" class="w-full py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-on-primary text-[10px] font-bold transition cursor-pointer">
                Activer l'Espace
              </button>
            </div>
          </div>
        `).join("");

        subViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Mes Espaces de Travail</h2>
              <a href="/spaces?view=new" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1 cursor-pointer">
                <span class="material-symbols-outlined text-sm">add_box</span>
                <span>Nouvel Espace</span>
              </a>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">📁</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Spaces Hub</h1>
                <p class="text-[11px] text-on-surface-variant">Cloisonnement multi-tenant de la plateforme (rôles, membres, isolation)</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/spaces?view=list" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'list' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Mes Espaces
              </a>
              <a href="/spaces?view=profile" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'profile' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Profil de l'Espace
              </a>
              <a href="/spaces?view=new" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === 'new' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Créer un Espace
              </a>
            </div>
          </div>

          <!-- Main Subview content -->
          ${subViewHtml}

        </div>
      `;

      return {
        contentHtml,
        pageTitle: `Spaces — ${view === 'profile' ? "Profil de l'Espace" : 'Gestion d\'Espaces'}`,
      };
    },
  };
}
