/**
 * @apps/citadelle — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Citadelle (Identity, Auth, RGPD).
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";

export function createCitadelleDescriptor(): BacDescriptor {
  const USERS = [
    { id: "u-001", name: "Lord Cheteck", email: "lord.cheteck@gmail.com", role: "Platform Governor", mfa: "Enabled" },
    { id: "u-002", name: "Sarah Connor", email: "s.connor@citadelle.io", role: "Support Agent", mfa: "Enabled" },
    { id: "u-003", name: "John Doe", email: "j.doe@citizen.dz", role: "Citizen", mfa: "Disabled" },
  ];

  return {
    id: "@apps/citadelle",
    name: "Citadelle Identity",
    version: "1.0.0",
    routePrefix: "/citadelle",
    icon: "🛡️",
    isEnabled: true,
    requiredPermissions: ["identity:user:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const tab = context.request.query.tab || "profile";
      const user = context.user;

      let tabContentHtml: string;
      if (tab === "users") {
        const rowsHtml = USERS.map(u => `
          <tr class="border-b border-outline-variant/10 hover:bg-surface-variant/20 transition-all text-xs">
            <td class="p-3 font-semibold text-on-surface">${escapeHtml(u.name)}</td>
            <td class="p-3 text-on-surface-variant/90">${escapeHtml(u.email)}</td>
            <td class="p-3">
              <span class="text-xs font-semibold text-primary">
                ${escapeHtml(u.role)}
              </span>
            </td>
            <td class="p-3">
              <span class="text-[10px] font-bold ${u.mfa === 'Enabled' ? 'text-emerald-400' : 'text-on-surface-variant/60'}">
                ${escapeHtml(u.mfa)}
              </span>
            </td>
            <td class="p-3 text-right">
              <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Action de gestion lancee'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-[10px] font-semibold text-on-surface cursor-pointer">
                Gérer
              </button>
            </td>
          </tr>
        `).join("");

        tabContentHtml = `
          <div class="glass-card rounded-2xl border border-outline-variant/20 overflow-hidden">
            <div class="p-4 bg-surface-container-low/40 border-b border-outline-variant/20 flex justify-between items-center">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Registre des Citoyens</h3>
              <span class="text-[10px] text-on-surface-variant font-mono tabular-nums">${USERS.length} utilisateurs enregistrés</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-outline-variant/20 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 bg-surface-container-low/20">
                    <th class="p-3">Nom complet</th>
                    <th class="p-3">Email</th>
                    <th class="p-3">Rôle système</th>
                    <th class="p-3">MFA</th>
                    <th class="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (tab === "security") {
        tabContentHtml = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- MFA Configuration Card -->
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-emerald-400 text-2xl">mfa</span>
                <div>
                  <h3 class="text-xs font-bold text-on-surface">Double Authentification (MFA / 2FA)</h3>
                  <p class="text-[10px] text-on-surface-variant mt-0.5">Sécurisez votre compte en exigeant un code temporaire TOTP.</p>
                </div>
              </div>
              <div class="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15 flex items-center justify-between">
                <span class="text-xs font-semibold text-on-surface">Statut MFA :</span>
                <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Activé (TOTP)</span>
              </div>
              <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Clé MFA réinitialisée'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-xs font-bold text-on-surface transition cursor-pointer">
                Régénérer la clé secrète
              </button>
            </div>

            <!-- Active Sessions Card -->
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-primary text-2xl">devices</span>
                <div>
                  <h3 class="text-xs font-bold text-on-surface">Sessions Actives & Connexions</h3>
                  <p class="text-[10px] text-on-surface-variant mt-0.5">Historique et révocation des terminaux connectés.</p>
                </div>
              </div>
              <div class="space-y-2">
                <div class="p-3 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/10 flex justify-between items-center text-xs">
                  <div>
                    <h4 class="font-bold">Chrome (Session Actuelle)</h4>
                    <p class="text-[9px] text-on-surface-variant">Paris, France • IP: 192.168.1.5</p>
                  </div>
                  <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Actif</span>
                </div>
              </div>
              <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Sessions révoquées'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-xs font-bold text-rose-400 transition cursor-pointer">
                Révoquer toutes les autres sessions
              </button>
            </div>

          </div>
        `;
      } else {
        // Default Tab: Profile & RGPD Anonymization
        tabContentHtml = `
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <!-- User Information card -->
            <div class="lg:col-span-8 glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Informations de Profil</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span class="text-[10px] text-on-surface-variant uppercase tracking-wider">Nom affiché</span>
                  <p class="font-bold text-on-surface mt-0.5">${escapeHtml(user.id || "Lord Cheteck")}</p>
                </div>
                <div>
                  <span class="text-[10px] text-on-surface-variant uppercase tracking-wider">Adresse Email</span>
                  <p class="font-bold text-on-surface mt-0.5">${escapeHtml(user.id === 'admin' ? 'lord.cheteck@gmail.com' : 'user@citadelle.io')}</p>
                </div>
                <div>
                  <span class="text-[10px] text-on-surface-variant uppercase tracking-wider">Rôle Principal</span>
                  <p class="font-bold text-on-surface mt-0.5">${escapeHtml(user.roles?.[0] || "admin")}</p>
                </div>
                <div>
                  <span class="text-[10px] text-on-surface-variant uppercase tracking-wider">ID unique de citoyen</span>
                  <p class="font-mono text-[10px] text-primary mt-0.5">${escapeHtml(user.id || "user_8249018240")}</p>
                </div>
              </div>
            </div>

            <!-- GDPR Card -->
            <div class="lg:col-span-4 glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <h3 class="text-xs font-bold uppercase tracking-wider text-rose-400">RGPD & Confidentialité</h3>
              <p class="text-[11px] text-on-surface-variant leading-relaxed font-normal">Conformément aux normes RGPD de la wilaya, vous pouvez demander l'extraction de vos données ou l'anonymisation complète et irréversible de votre compte citoyen.</p>
              
              <div class="space-y-2 pt-2 text-xs">
                <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Extraction initiée !'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="w-full py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 font-bold text-on-surface transition cursor-pointer">
                  Exporter mes données (.json)
                </button>
                <button onclick="if(confirm('Voulez-vous anonymiser votre compte ?')){const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Compte anonymisé !'; document.body.appendChild(t); setTimeout(()=>window.location.href='/',2000);}" class="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 font-bold text-rose-400 transition cursor-pointer">
                  Anonymiser mon compte
                </button>
              </div>
            </div>

          </div>
        `;
      }

      const contentHtml = `
        <div class="space-y-6">
          
          <!-- Tab selector / header -->
          <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">🛡️</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Citadelle IAM</h1>
                <p class="text-[11px] text-on-surface-variant">Gestion des accès, identités et conformité RGPD</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/citadelle?tab=profile" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'profile' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Mon Profil
              </a>
              <a href="/citadelle?tab=security" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'security' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                Sécurité & MFA
              </a>
              ${user.roles?.includes("admin") || user.id === "admin" ? `
                <a href="/citadelle?tab=users" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'users' ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15'}">
                  Utilisateurs (Admin)
                </a>
              ` : ''}
            </div>
          </div>

          <!-- Active tab content rendering -->
          ${tabContentHtml}

        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Citadelle — Gestion des Identités & IAM",
      };
    },
  };
}
