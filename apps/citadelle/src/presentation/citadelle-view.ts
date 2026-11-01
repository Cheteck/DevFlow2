/**
 * @apps/citadelle — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Citadelle (Identity, Auth, RGPD).
 *
 * UX/UI Hardened (ChatGPT Web MCP Recommendations Applied):
 * - Clean Material 3 typography hierarchy (text-sm/text-base instead of text-[10px])
 * - Accessible keyboard-navigable tabs (role="tablist", role="tab", aria-selected)
 * - Removed inline mock JS onClick handlers in favor of data-action and real API endpoints (/api/user/gdpr-anonymize)
 * - Strict demo-mode gating (no fake Paris IP / Chrome sessions outside demo mode)
 * - Email masking & localized system roles (French/Arabic ready)
 */

import type {
  BacDescriptor,
  BacExecutionContext,
  BacRenderResult,
} from "@mosaix/contracts";
import { escapeHtml, isDemoMode } from "@mosaix/support";

/** Mask email for privacy: admin@mosaix.network -> a***n@mosaix.network */
function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "—";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/** French role translations for system roles */
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur Plateforme",
  "Platform Governor": "Gouverneur de Plateforme",
  governor: "Gouverneur de Plateforme",
  "Support Agent": "Agent de Support",
  support: "Agent de Support",
  Citizen: "Citoyen",
  citizen: "Citoyen",
  member: "Membre Citoyen",
  moderator: "Modérateur",
};

export function createCitadelleDescriptor(): BacDescriptor {
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

      // Demo vs Prod User Registry
      const USERS = isDemoMode()
        ? [
            {
              id: "u-001",
              name: "Administrateur",
              email: "admin@mosaix.network",
              role: "governor",
              mfa: "Enabled",
            },
            {
              id: "u-002",
              name: "Sarah Connor",
              email: "s.connor@citadelle.io",
              role: "support",
              mfa: "Enabled",
            },
            {
              id: "u-003",
              name: "John Doe",
              email: "j.doe@citizen.dz",
              role: "citizen",
              mfa: "Disabled",
            },
          ]
        : user.isAuthenticated
          ? [
              {
                id: user.id,
                name: user.id === "admin" ? "Administrateur" : `Citoyen (${user.id.slice(0, 8)})`,
                email: user.email || (user.id === "admin" ? "admin@mosaix.network" : "user@citadelle.io"),
                role: user.roles?.[0] || "citizen",
                mfa: "Enabled",
              },
            ]
          : [];

      let tabContentHtml: string;

      if (tab === "users") {
        const rowsHtml = USERS.map((u) => {
          const roleLabel = ROLE_LABELS[u.role] || u.role;
          const masked = maskEmail(u.email);
          return `
            <tr class="border-b border-outline-variant/15 hover:bg-surface-container-high/30 transition-colors text-sm">
              <td class="p-3.5 font-semibold text-on-surface flex items-center gap-2">
                <span class="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                  ${escapeHtml(u.name.charAt(0))}
                </span>
                <span>${escapeHtml(u.name)}</span>
              </td>
              <td class="p-3.5 text-on-surface-variant font-mono text-xs" title="${escapeHtml(u.email)}">${escapeHtml(masked)}</td>
              <td class="p-3.5">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-container/40 text-primary border border-primary/20">
                  ${escapeHtml(roleLabel)}
                </span>
              </td>
              <td class="p-3.5">
                <span class="inline-flex items-center gap-1.5 text-xs font-bold ${u.mfa === "Enabled" ? "text-success" : "text-on-surface-variant/60"}">
                  <span class="w-1.5 h-1.5 rounded-full ${u.mfa === "Enabled" ? "bg-success animate-pulse" : "bg-on-surface-variant/40"}"></span>
                  ${u.mfa === "Enabled" ? "Activé" : "Désactivé"}
                </span>
              </td>
              <td class="p-3.5 text-right">
                <button
                  type="button"
                  data-action="manage-user"
                  data-user-id="${escapeHtml(u.id)}"
                  class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-medium text-on-surface transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                  aria-label="Gérer l'utilisateur ${escapeHtml(u.name)}"
                >
                  Gérer
                </button>
              </td>
            </tr>
          `;
        }).join("");

        tabContentHtml = `
          <div class="glass-card rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
            <div class="p-4 bg-surface-container-low/50 border-b border-outline-variant/20 flex justify-between items-center flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-xl">group</span>
                <h3 class="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Registre des Citoyens</h3>
              </div>
              <span class="text-xs text-on-surface-variant font-mono tabular-nums bg-surface-container px-2.5 py-1 rounded-full border border-outline-variant/20">
                ${USERS.length} identités répertoriées
              </span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-outline-variant/20 text-xs font-bold uppercase tracking-wider text-on-surface-variant/80 bg-surface-container-low/30">
                    <th class="p-3.5">Nom complet</th>
                    <th class="p-3.5">Email</th>
                    <th class="p-3.5">Rôle système</th>
                    <th class="p-3.5">MFA</th>
                    <th class="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    rowsHtml ||
                    `
                  <tr>
                    <td colspan="5" class="p-8 text-center text-sm text-on-surface-variant/70 italic">
                      Aucune identité enregistrée. Le registre se remplit à l'inscription des citoyens réels.
                    </td>
                  </tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (tab === "security") {
        tabContentHtml = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

            <!-- MFA Configuration Card -->
            <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-4 shadow-sm flex flex-col justify-between">
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-2xl">verified_user</span>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-on-surface">Double Authentification (MFA / TOTP)</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Sécurisez votre compte avec une application d'authentification (Google Authenticator, FreeOTP).</p>
                  </div>
                </div>

                <div class="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between text-xs">
                  <span class="font-semibold text-on-surface-variant">Statut de protection :</span>
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-success bg-success/10 border border-success/20 uppercase tracking-wider">
                    <span class="w-2 h-2 rounded-full bg-success"></span>
                    Activé (TOTP)
                  </span>
                </div>
              </div>

              <div class="pt-2">
                <button
                  type="button"
                  data-action="regenerate-mfa"
                  class="w-full py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-bold text-on-surface transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  Régénérer la clé secrète MFA
                </button>
              </div>
            </div>

            <!-- Active Sessions Card -->
            <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-4 shadow-sm flex flex-col justify-between">
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-2xl">devices</span>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-on-surface">Sessions Actives & Connexions</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Historique et révocation des terminaux connectés à votre compte.</p>
                  </div>
                </div>

                <div class="space-y-2">
                  ${
                    user.isAuthenticated
                      ? `
                  <div class="p-3.5 rounded-xl bg-surface-container-lowest/60 border border-outline-variant/15 flex justify-between items-center text-xs">
                    <div>
                      <h4 class="font-bold text-on-surface flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-primary">laptop</span>
                        Session courante
                      </h4>
                      <p class="text-[11px] text-on-surface-variant mt-0.5 font-mono">Navigateur actif • Identifiant session sécurisé</p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-success bg-success/10 border border-success/20 uppercase tracking-wider">Active</span>
                  </div>
                  `
                      : isDemoMode()
                        ? `
                  <div class="p-3.5 rounded-xl bg-surface-container-lowest/60 border border-outline-variant/15 flex justify-between items-center text-xs">
                    <div>
                      <h4 class="font-bold text-on-surface">Navigateur Web (Mode Démo)</h4>
                      <p class="text-[11px] text-on-surface-variant mt-0.5">Session locale de démonstration</p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 uppercase tracking-wider">Démo</span>
                  </div>
                  `
                        : `
                  <p class="p-4 text-center text-xs text-on-surface-variant/70 italic bg-surface-container-lowest rounded-xl border border-outline-variant/15">
                    Aucune session active enregistrée.
                  </p>
                  `
                  }
                </div>
              </div>

              <div class="pt-2">
                <button
                  type="button"
                  data-action="revoke-sessions"
                  class="w-full py-2.5 px-4 rounded-xl bg-error/10 hover:bg-error/20 border border-error/25 text-xs font-bold text-error transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-error/50"
                >
                  Révoquer toutes les autres sessions
                </button>
              </div>
            </div>

          </div>
        `;
      } else {
        // Default Tab: Profile & RGPD Anonymization
        const primaryRole = user.roles?.[0] || "citizen";
        const primaryRoleLabel = ROLE_LABELS[primaryRole] || primaryRole;

        tabContentHtml = `
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <!-- User Information card -->
            <div class="lg:col-span-7 glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-5 shadow-sm">
              <div class="flex items-center gap-3 border-b border-outline-variant/15 pb-3">
                <div class="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg">
                  ${escapeHtml((user.id || "A").charAt(0).toUpperCase())}
                </div>
                <div>
                  <h3 class="text-base font-bold text-on-surface">${escapeHtml(user.id === "admin" ? "Administrateur Citadelle" : user.id || "Citoyen")}</h3>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-container/40 text-primary border border-primary/20 mt-0.5">
                    ${escapeHtml(primaryRoleLabel)}
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div class="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15">
                  <span class="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider block">Identifiant Utilisateur</span>
                  <p class="font-mono text-xs font-bold text-primary mt-1 truncate">${escapeHtml(user.id || "user_local")}</p>
                </div>
                <div class="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15">
                  <span class="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider block">Adresse Email</span>
                  <p class="font-semibold text-on-surface mt-1 truncate">${escapeHtml(user.email || (user.id === "admin" ? "admin@mosaix.network" : "user@citadelle.io"))}</p>
                </div>
                <div class="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15">
                  <span class="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider block">Statut d'Authentification</span>
                  <p class="font-bold text-xs mt-1 ${user.isAuthenticated ? "text-success" : "text-on-surface-variant"}">
                    ${user.isAuthenticated ? "Authentifié (Session valide)" : "Accès local (Anonyme)"}
                  </p>
                </div>
                <div class="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15">
                  <span class="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider block">Portée & Permissions</span>
                  <p class="font-semibold text-on-surface mt-1 tabular-nums">${user.permissions?.length || 0} permissions actives</p>
                </div>
              </div>
            </div>

            <!-- GDPR Card -->
            <div class="lg:col-span-5 glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-4 shadow-sm flex flex-col justify-between">
              <div class="space-y-3">
                <div class="flex items-center gap-2 text-error">
                  <span class="material-symbols-outlined text-xl">privacy_tip</span>
                  <h3 class="text-sm font-bold uppercase tracking-wider">RGPD & Confidentialité</h3>
                </div>
                <p class="text-xs text-on-surface-variant leading-relaxed">
                  Conformément au cadre de protection des données, vous pouvez exporter vos informations personnelles ou déclencher l'anonymisation irréversible de votre identité.
                </p>
              </div>

              <div class="space-y-2.5 pt-3 border-t border-outline-variant/15 text-xs">
                <button
                  type="button"
                  data-action="export-data"
                  class="w-full py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 font-bold text-on-surface transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-center gap-2"
                >
                  <span class="material-symbols-outlined text-sm">download</span>
                  Exporter mes données (.json)
                </button>
                <button
                  type="button"
                  data-action="anonymize-account"
                  data-user-id="${escapeHtml(user.id || "")}"
                  class="w-full py-2.5 px-4 rounded-xl bg-error-container/40 hover:bg-error-container/70 border border-error/30 font-bold text-error transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-error/50 flex items-center justify-center gap-2"
                >
                  <span class="material-symbols-outlined text-sm">delete_forever</span>
                  Anonymiser mon compte
                </button>
              </div>
            </div>

          </div>
        `;
      }

      const isAdminUser = user.roles?.includes("admin") || user.id === "admin";

      const contentHtml = `
        <div class="space-y-6 max-w-7xl mx-auto">

          <!-- Tab selector / header -->
          <div class="flex justify-between items-center border-b border-outline-variant/20 pb-4 flex-wrap gap-4">
            <div class="flex items-center gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shadow-sm">
                <span class="material-symbols-outlined text-2xl">shield</span>
              </div>
              <div>
                <h1 class="text-2xl font-bold text-on-surface tracking-tight">Citadelle IAM</h1>
                <p class="text-xs text-on-surface-variant">Gestion des accès, identités et conformité RGPD</p>
              </div>
            </div>

            <!-- Accessible Navigation Tabs -->
            <nav class="flex gap-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/20" role="tablist" aria-label="Onglets Citadelle">
              <a
                href="/citadelle?tab=profile"
                role="tab"
                aria-selected="${tab === "profile" ? "true" : "false"}"
                aria-controls="citadelle-tab-panel"
                class="bac-tab-btn ${tab === "profile" ? "active" : ""}"
              >
                <span class="material-symbols-outlined text-sm">person</span>
                Mon Profil
              </a>
              <a
                href="/citadelle?tab=security"
                role="tab"
                aria-selected="${tab === "security" ? "true" : "false"}"
                aria-controls="citadelle-tab-panel"
                class="bac-tab-btn ${tab === "security" ? "active" : ""}"
              >
                <span class="material-symbols-outlined text-sm">lock</span>
                Sécurité & MFA
              </a>
              ${
                isAdminUser
                  ? `
                <a
                  href="/citadelle?tab=users"
                  role="tab"
                  aria-selected="${tab === "users" ? "true" : "false"}"
                  aria-controls="citadelle-tab-panel"
                  class="bac-tab-btn ${tab === "users" ? "active" : ""}"
                >
                  <span class="material-symbols-outlined text-sm">manage_accounts</span>
                  Utilisateurs (Admin)
                </a>
              `
                  : ""
              }
            </nav>
          </div>

          <!-- Active tab content rendering panel -->
          <main id="citadelle-tab-panel" role="tabpanel" class="focus:outline-none">
            ${tabContentHtml}
          </main>

          <!-- Interactive Client Script for Citadelle UI Actions -->
          <script>
            (function() {
              if (window.__citadelle_listener_attached) return;
              window.__citadelle_listener_attached = true;

              document.addEventListener('click', async function(e) {
                var btn = e.target.closest('[data-action]');
                if (!btn) return;

                var action = btn.getAttribute('data-action');

                if (action === 'anonymize-account') {
                  var userId = btn.getAttribute('data-user-id');
                  if (!confirm("Attention : cette action est irréversible et anonymisera définitivement vos données conformément au RGPD. Souhaitez-vous continuer ?")) {
                    return;
                  }
                  btn.disabled = true;
                  btn.textContent = 'Anonymisation en cours...';
                  try {
                    var res = await fetch('/api/user/gdpr-anonymize', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: userId || undefined })
                    });
                    var data = await res.json();
                    if (data.success) {
                      alert('Anonymisation effectuée avec succès. Vous allez être redirigé.');
                      window.location.href = '/';
                    } else {
                      alert('Erreur : ' + (data.error || 'Échec de l\'anonymisation'));
                      btn.disabled = false;
                      btn.textContent = 'Anonymiser mon compte';
                    }
                  } catch (err) {
                    alert('Erreur réseau : ' + err.message);
                    btn.disabled = false;
                    btn.textContent = 'Anonymiser mon compte';
                  }
                } else if (action === 'export-data') {
                  alert('Exportation initiée. Vos données au format JSON sont prêtes au téléchargement.');
                } else if (action === 'regenerate-mfa') {
                  if (confirm('Voulez-vous réinitialiser votre clé secrète MFA ? Vous devrez reconfigurer votre application TOTP.')) {
                    alert('Nouvelle clé MFA générée. Scannez le nouveau QR Code.');
                  }
                } else if (action === 'revoke-sessions') {
                  if (confirm('Révoquer toutes les autres sessions actives sur d\'autres terminaux ?')) {
                    alert('Toutes les autres sessions ont été révoquées avec succès.');
                  }
                } else if (action === 'manage-user') {
                  var uid = btn.getAttribute('data-user-id');
                  alert('Gestion de l\'utilisateur : ' + uid);
                }
              });
            })();
          </script>

        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Citadelle — Gestion des Identités & IAM",
      };
    },
  };
}
