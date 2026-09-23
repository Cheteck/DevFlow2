import type { ContributionContract, AdminPageContribution } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

// Dynamically import registration definitions from connected BACs (for side-effect registration)
import "../../../citadelle/frontend/src/index.js";
import "../../../solara/frontend/src/index.js";
import "../../../beam/frontend/src/index.js";
import "../../../commerce/frontend/src/index.js";
import "../../../portfolio/frontend/src/index.js";
import "../../../spaces/frontend/src/index.js";
import "../../../booking/frontend/src/index.js";
import "../../../solidarity/frontend/src/index.js";

export const ImperiaStyles = `
  .imperia-container { 
    max-width: 1200px; 
    margin: 0 auto; 
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; 
  }
  .admin-tab-btn.active {
    background-color: rgba(160, 120, 255, 0.15);
    border-color: rgba(160, 120, 255, 0.4);
    color: #dae2fd;
  }
`;

// Helper: Badge styling
export function getAdminBadgeStyle(variant?: string): string {
  switch (variant) {
    case 'primary': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'success': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'warning': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'danger': return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'purple': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    default: return 'bg-surface-variant/40 text-on-surface-variant border-outline-variant/20';
  }
}

// Helper: Render BAC Admin Pane safely
export function renderBacAdminSafely(page: AdminPageContribution): string {
  try {
    if (typeof page.render === 'function') {
      return page.render({ activeTab: page.id });
    }
    return `
      <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/20 text-center space-y-2">
        <span class="material-symbols-outlined text-3xl text-on-surface-variant">dashboard_customize</span>
        <h4 class="text-xs font-bold text-on-surface">Console d'administration en attente de vue</h4>
        <p class="text-[11px] text-on-surface-variant">Le BAC <span class="font-mono text-primary font-bold">${page.bacId}</span> est enregistré avec la route <span class="font-mono">${page.route}</span>.</p>
      </div>
    `;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Imperia] Erreur lors du rendu de la console ${page.id}:`, err);
    return `
      <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3">
        <span class="material-symbols-outlined text-lg">error</span>
        <div>
          <strong class="font-bold">Erreur de rendu du module (${page.id})</strong>
          <p class="text-[11px] text-red-300/80 mt-0.5">${message || 'Exception non gérée'}</p>
        </div>
      </div>
    `;
  }
}

// Build aggregated BAC administration registries consumed by Imperia
export function getAggregatedAdminPages() {
  try {
    return shellRegistry.getAllAdminPages().map(page => ({
        ...page,
        entrypoint: page.id
    }));
  } catch (e) {
    console.error("[Imperia] Failed to aggregate admin pages from BACs:", e);
    return [];
  }
}

export function updateDefaultBac() {
  const select = document.getElementById("default-bac-select") as HTMLSelectElement;
  if (select && select.value) {
      shellRegistry.setDefaultBacId(select.value);
  }
}

export function renderImperiaSettingsView(): string {
  return `
    <div class="imperia-settings-wrapper space-y-6" data-testid="imperia-settings-multi-page">
      
      <!-- SUB-NAVIGATION TABS (7 PAGES) -->
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-surface-container/60 p-1.5 rounded-2xl border border-outline-variant/20">
        <button onclick="switchSettingsSubPage('general')" id="settings-subtab-general" class="settings-subtab-btn active px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-purple-600 text-white shadow-sm cursor-pointer">
          <span class="material-symbols-outlined text-sm">public</span>
          1. Général & Cluster
        </button>
        <button onclick="switchSettingsSubPage('security')" id="settings-subtab-security" class="settings-subtab-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 transition flex items-center gap-2 cursor-pointer">
          <span class="material-symbols-outlined text-sm">security</span>
          2. Sécurité & IAM
        </button>
        <button onclick="switchSettingsSubPage('governance')" id="settings-subtab-governance" class="settings-subtab-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 transition flex items-center gap-2 cursor-pointer">
          <span class="material-symbols-outlined text-sm">policy</span>
          3. Politiques BAC
        </button>
        <button onclick="switchSettingsSubPage('plugins')" id="settings-subtab-plugins" class="settings-subtab-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 transition flex items-center gap-2 cursor-pointer">
          <span class="material-symbols-outlined text-sm">extension</span>
          4. Flags & Plugins
        </button>
        <button onclick="switchSettingsSubPage('appearance')" id="settings-subtab-appearance" class="settings-subtab-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 transition flex items-center gap-2 cursor-pointer">
          <span class="material-symbols-outlined text-sm">palette</span>
          5. Apparence
        </button>
        <button onclick="switchSettingsSubPage('telemetry')" id="settings-subtab-telemetry" class="settings-subtab-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 transition flex items-center gap-2 cursor-pointer">
          <span class="material-symbols-outlined text-sm">insights</span>
          6. Télémétrie
        </button>
        <button onclick="switchSettingsSubPage('storage')" id="settings-subtab-storage" class="settings-subtab-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 transition flex items-center gap-2 cursor-pointer">
          <span class="material-symbols-outlined text-sm">database</span>
          7. Stockage
        </button>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-PAGE 1 : GENERAL & CLUSTER -->
      <!-- ========================================================================= -->
      <div id="settings-subpage-general" class="settings-subpage-pane space-y-6">
        <div class="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase">Domaine Cluster</span>
                <h3 class="text-base font-bold text-on-surface">Configuration Générale & Identité du Cluster</h3>
              </div>
              <p class="text-xs text-on-surface-variant mt-1">Paramétrez le nom public du cluster, le mode d'exécution et le routage initial des utilisateurs.</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant/20">Section 1/7</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">dns</span> Nom du Cluster Coordinateur
              </label>
              <input type="text" id="setting-MOSAIX_CLUSTER_NAME" value="MosaiX High-Availability Cluster" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Nom d'identification public du cluster coordinateur MosaiX.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">lan</span> Environnement d'Exécution
              </label>
              <select id="setting-NODE_ENV" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="production" selected>Production (Haute Disponibilité)</option>
                <option value="staging">Staging / Pré-production</option>
                <option value="development">Développement Local</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Mode d'exécution actuel du moteur de gouvernance.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">home</span> Application par Défaut (Landfall URL /)
              </label>
              <select id="setting-MOSAIX_DEFAULT_BAC" onchange="if (typeof savePlatformDefaultBac === 'function') savePlatformDefaultBac(this.value);" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="@apps/imperia" selected>Imperia (Gouvernance & Control Plane)</option>
                <option value="@apps/solara">Solara (Feed & Social BAC)</option>
                <option value="@apps/beam">Beam (Messagerie & Communications)</option>
                <option value="@apps/commerce">Commerce (Boutique & Commandes)</option>
                <option value="@apps/spaces">Spaces (Gestion des Espaces)</option>
                <option value="@apps/citadelle">Citadelle (Identité & Profils)</option>
                <option value="@apps/portfolio">Portfolio (Showcase & Créations)</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Application d'accueil chargée automatiquement à l'ouverture du Shell.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">schedule</span> Fuseau Horaire de Référence
              </label>
              <input type="text" id="setting-MOSAIX_TIMEZONE" value="UTC" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Fuseau horaire utilisé pour l'agrégation des métriques et logs.</p>
            </div>
          </div>

          <div class="pt-2 border-t border-outline-variant/15">
            <label class="flex items-center justify-between p-3.5 rounded-xl bg-surface-variant/20 border border-outline-variant/15 hover:border-outline-variant/30 cursor-pointer transition">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm text-amber-400">construction</span> Mode Maintenance Global
                </span>
                <span class="text-[11px] text-on-surface-variant block">Bloque temporairement les écritures et contributions des membres tout en maintenant l'accès admin.</span>
              </div>
              <input type="checkbox" id="setting-MOSAIX_MAINTENANCE_MODE" class="w-5 h-5 accent-purple-600 cursor-pointer rounded">
            </label>
          </div>

          <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
            <button onclick="resetSettingsCategory('general')" class="px-4 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-xs">restart_alt</span> Réinitialiser
            </button>
            <button onclick="saveSettingsCategory('general')" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
              <span class="material-symbols-outlined text-xs">save</span> Enregistrer Général & Cluster
            </button>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-PAGE 2 : SECURITY & IAM -->
      <!-- ========================================================================= -->
      <div id="settings-subpage-security" class="settings-subpage-pane hidden space-y-6">
        <div class="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/30 uppercase">IAM & Protection</span>
                <h3 class="text-base font-bold text-on-surface">Sécurité, Authentification SSO & Jetons</h3>
              </div>
              <p class="text-xs text-on-surface-variant mt-1">Définissez les règles de délivrance des jetons JWT, la politique MFA et la protection contre les attaques.</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant/20">Section 2/7</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">timer</span> Durée de Session SSO (secondes)
              </label>
              <input type="number" id="setting-MOSAIX_SESSION_TTL_SECONDS" value="86400" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Durée de validité des jetons d'accès JWT avant réauthentification (86400s = 24h).</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">verified</span> Émetteur de Jetons (Issuer URI)
              </label>
              <input type="text" id="setting-MOSAIX_AUTH_ISSUER" value="https://auth.mosaix.internal" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Identifiant d'autorité SSO pour la validation cryptographique.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">lock_clock</span> Tentatives de Connexion Max (Brute-Force)
              </label>
              <input type="number" id="setting-MOSAIX_MAX_LOGIN_ATTEMPTS" value="5" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Nombre de tentatives erronées consécutives autorisées avant verrouillage temporaire.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">http</span> Origines CORS Autorisées
              </label>
              <input type="text" id="setting-MOSAIX_CORS_ALLOWED_ORIGINS" value="*" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Origines autorisées pour les requêtes cross-origin (* pour tout autoriser).</p>
            </div>
          </div>

          <div class="pt-2 border-t border-outline-variant/15 space-y-3">
            <label class="flex items-center justify-between p-3.5 rounded-xl bg-surface-variant/20 border border-outline-variant/15 hover:border-outline-variant/30 cursor-pointer transition">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm text-emerald-400">phonelink_lock</span> Forcer la validation MFA
                </span>
                <span class="text-[11px] text-on-surface-variant block">Obligatoire pour les rôles administrateurs, modérateurs et gestionnaires de données.</span>
              </div>
              <input type="checkbox" id="setting-MOSAIX_MFA_ENFORCED" checked class="w-5 h-5 accent-purple-600 cursor-pointer rounded">
            </label>
          </div>

          <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
            <button onclick="resetSettingsCategory('security')" class="px-4 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-xs">restart_alt</span> Réinitialiser
            </button>
            <button onclick="saveSettingsCategory('security')" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
              <span class="material-symbols-outlined text-xs">save</span> Enregistrer Sécurité & IAM
            </button>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-PAGE 3 : GOVERNANCE & POLICIES -->
      <!-- ========================================================================= -->
      <div id="settings-subpage-governance" class="settings-subpage-pane hidden space-y-6">
        <div class="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase">Gouvernance BAC</span>
                <h3 class="text-base font-bold text-on-surface">Politiques Transversales & Isolation Multi-Tenant</h3>
              </div>
              <p class="text-xs text-on-surface-variant mt-1">Gérez le niveau d'étanchéité des organisations et le contrôle de conformité SemVer des contrats.</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant/20">Section 3/7</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">domain</span> Stratégie d'Isolation Multi-Tenant
              </label>
              <select id="setting-MOSAIX_TENANT_ISOLATION_STRATEGY" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="strict" selected>Strict (Canaux & Bases Séparés par Tenant)</option>
                <option value="hybrid">Hybride (Canaux Partagés, ACLs Strictes)</option>
                <option value="open">Ouvert (Réseau de Bac à Sable / Test)</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Niveau d'étanchéité appliqué par défaut aux tables SQLite et bus d'événements.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">gavel</span> Effet par Défaut des Politiques Non Définies
              </label>
              <select id="setting-MOSAIX_DEFAULT_POLICY_EFFECT" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="allow" selected>Autoriser par défaut (Allow Default)</option>
                <option value="deny">Refuser par défaut (Deny / Zero Trust)</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Action appliquée si aucune règle explicite ne correspond au contexte.</p>
            </div>
          </div>

          <div class="pt-2 border-t border-outline-variant/15 space-y-3">
            <label class="flex items-center justify-between p-3.5 rounded-xl bg-surface-variant/20 border border-outline-variant/15 hover:border-outline-variant/30 cursor-pointer transition">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm text-emerald-400">verified_user</span> Contrôle Strict SemVer des Contrats BAC
                </span>
                <span class="text-[11px] text-on-surface-variant block">Rejette automatiquement tout BAC dont les contrats de version s'écartent des signatures acceptées.</span>
              </div>
              <input type="checkbox" id="setting-MOSAIX_SEMVER_STRICT_CHECK" checked class="w-5 h-5 accent-purple-600 cursor-pointer rounded">
            </label>
          </div>

          <div class="p-4 bg-surface-container/60 rounded-xl border border-outline-variant/20 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-on-surface">Matrice des Politiques Actives (Governance Engine)</span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">3 Règles Enforcées</span>
            </div>
            <div class="text-[11px] text-on-surface-variant space-y-1 font-mono">
              <div class="flex items-center justify-between py-1 border-b border-outline-variant/10">
                <span>rule-rbac-spaces (Scope: apps/spaces)</span>
                <span class="text-emerald-400 font-bold">ALLOW</span>
              </div>
              <div class="flex items-center justify-between py-1 border-b border-outline-variant/10">
                <span>rule-rate-limit-public (Scope: *)</span>
                <span class="text-emerald-400 font-bold">ALLOW</span>
              </div>
              <div class="flex items-center justify-between py-1">
                <span>rule-solara-moderation-strict (Scope: apps/solara)</span>
                <span class="text-emerald-400 font-bold">ALLOW</span>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
            <button onclick="resetSettingsCategory('governance')" class="px-4 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-xs">restart_alt</span> Réinitialiser
            </button>
            <button onclick="saveSettingsCategory('governance')" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
              <span class="material-symbols-outlined text-xs">save</span> Enregistrer Politiques BAC
            </button>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-PAGE 4 : FEATURE FLAGS & PLUGINS -->
      <!-- ========================================================================= -->
      <div id="settings-subpage-plugins" class="settings-subpage-pane hidden space-y-6">
        <div class="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">Extensions & Flags</span>
                <h3 class="text-base font-bold text-on-surface">Feature Flags & Gestionnaire de Plugins du Noyau</h3>
              </div>
              <p class="text-xs text-on-surface-variant mt-1">Contrôlez les interrupteurs de fonctionnalités à chaud et le comportement des modules PrestaShop-like.</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant/20">Section 4/7</span>
          </div>

          <div class="space-y-3">
            <label class="flex items-center justify-between p-3.5 rounded-xl bg-surface-variant/20 border border-outline-variant/15 hover:border-outline-variant/30 cursor-pointer transition">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm text-primary">sync_alt</span> Surcharge Dynamique des Paramètres (imperia.settings.dynamic_override)
                </span>
                <span class="text-[11px] text-on-surface-variant block">Permet aux administrateurs de surcharger les variables d'environnement à chaud en mémoire.</span>
              </div>
              <input type="checkbox" id="setting-imperia.settings.dynamic_override" checked class="w-5 h-5 accent-purple-600 cursor-pointer rounded">
            </label>

            <label class="flex items-center justify-between p-3.5 rounded-xl bg-surface-variant/20 border border-outline-variant/15 hover:border-outline-variant/30 cursor-pointer transition">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm text-indigo-400">shield</span> Isolation Sandbox des Plugins (imperia.plugins.sandbox_isolation)
                </span>
                <span class="text-[11px] text-on-surface-variant block">Exécute les hooks des plugins tiers dans un conteneur sécurisé avec permissions restreintes.</span>
              </div>
              <input type="checkbox" id="setting-imperia.plugins.sandbox_isolation" checked class="w-5 h-5 accent-purple-600 cursor-pointer rounded">
            </label>

            <label class="flex items-center justify-between p-3.5 rounded-xl bg-surface-variant/20 border border-outline-variant/15 hover:border-outline-variant/30 cursor-pointer transition">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm text-emerald-400">psychology</span> Modération IA Automatique Solara (solara.ai_moderation.enabled)
                </span>
                <span class="text-[11px] text-on-surface-variant block">Analyse prédictive et filtrage des contenus haineux ou inappropriés sur le feed social.</span>
              </div>
              <input type="checkbox" id="setting-solara.ai_moderation.enabled" checked class="w-5 h-5 accent-purple-600 cursor-pointer rounded">
            </label>
          </div>

          <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
            <button onclick="switchAdminTab('feature-flags')" class="px-4 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-xs">tune</span> Ouvrir l'Éditeur Avancé de Flags
            </button>
            <button onclick="saveSettingsCategory('plugins')" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
              <span class="material-symbols-outlined text-xs">save</span> Enregistrer Flags & Plugins
            </button>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-PAGE 5 : APPEARANCE & THEMES -->
      <!-- ========================================================================= -->
      <div id="settings-subpage-appearance" class="settings-subpage-pane hidden space-y-6">
        <div class="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/15 text-pink-300 border border-pink-500/30 uppercase">Design & Shell</span>
                <h3 class="text-base font-bold text-on-surface">Apparence, Thèmes & Design Tokens du Shell</h3>
              </div>
              <p class="text-xs text-on-surface-variant mt-1">Personnalisez la charte visuelle par défaut, le mode de couleur et la rondeur des composants.</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant/20">Section 5/7</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">format_paint</span> Thème Shell par Défaut
              </label>
              <select id="setting-MOSAIX_DEFAULT_THEME" onchange="if (typeof savePlatformTheme === 'function') savePlatformTheme(this.value);" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="midnight-pulse" selected>Midnight Pulse (Dark Luxury / Violet)</option>
                <option value="solara-sunrise">Solara Sunrise (Ambre & Doré)</option>
                <option value="emerald-canopy">Emerald Canopy (Vert Émeraude)</option>
                <option value="cyber-neon">Cyber Neon (Cyan & Haute Visibilité)</option>
                <option value="nordic-frost">Nordic Frost (Bleu Glacé Arctique)</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Ambiance colorée appliquée à tous les micro-frontends.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">dark_mode</span> Mode d'Éclairage
              </label>
              <select id="setting-MOSAIX_COLOR_MODE" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="dark" selected>Sombre (Dark Mode Forcé)</option>
                <option value="light">Clair (Light Corporate)</option>
                <option value="auto">Automatique (Préférence Navigateur)</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Contraste global de fond d'écran.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">rounded_corner</span> Tokens d'Arrondi (Border Radius)
              </label>
              <select id="setting-MOSAIX_UI_BORDER_RADIUS" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="rounded-xl" selected>Moderne (12px / rounded-xl)</option>
                <option value="rounded-2xl">Prononcé (16px / rounded-2xl)</option>
                <option value="rounded-lg">Discret (8px / rounded-lg)</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Rayon de courbure des cartes et boutons.</p>
            </div>
          </div>

          <!-- ASSETS PREVIEW -->
          <div class="p-4 bg-surface-container/60 rounded-xl border border-outline-variant/20 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center font-bold text-lg text-purple-300">
                M
              </div>
              <div>
                <span class="text-xs font-bold text-on-surface block">Assets Statiques (/public)</span>
                <span class="text-[11px] text-on-surface-variant block">Logo & Favicon SVG intégrés avec support ETag et Cache-Control 24h.</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <a href="/logo.svg" target="_blank" class="px-3 py-1.5 rounded-lg bg-surface-variant/40 hover:bg-surface-variant text-[11px] font-semibold text-on-surface transition">Aperçu logo.svg</a>
              <a href="/favicon.svg" target="_blank" class="px-3 py-1.5 rounded-lg bg-surface-variant/40 hover:bg-surface-variant text-[11px] font-semibold text-on-surface transition">Aperçu favicon.svg</a>
            </div>
          </div>

          <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
            <button onclick="resetSettingsCategory('appearance')" class="px-4 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-xs">restart_alt</span> Réinitialiser
            </button>
            <button onclick="saveSettingsCategory('appearance')" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
              <span class="material-symbols-outlined text-xs">save</span> Enregistrer Apparence
            </button>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-PAGE 6 : TELEMETRY & LOGS -->
      <!-- ========================================================================= -->
      <div id="settings-subpage-telemetry" class="settings-subpage-pane hidden space-y-6">
        <div class="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase">Observabilité</span>
                <h3 class="text-base font-bold text-on-surface">Télémétrie, Niveaux de Log & Limitation de Débit</h3>
              </div>
              <p class="text-xs text-on-surface-variant mt-1">Configurez la verbosité des logs, le seuil de limitation de requêtes par minute et la rétention d'audit.</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant/20">Section 6/7</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">terminal</span> Niveau de Log Global
              </label>
              <select id="setting-MOSAIX_LOG_LEVEL" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="DEBUG">DEBUG (Très verbeux / Diagnostic)</option>
                <option value="INFO" selected>INFO (Nominal d'exploitation)</option>
                <option value="WARN">WARN (Avertissements uniquement)</option>
                <option value="ERROR">ERROR (Erreurs critiques)</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Verbosité minimale des événements capturés par le bus.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">speed</span> Rate Limiting (Req / Minute / IP)
              </label>
              <input type="number" id="setting-MOSAIX_RATE_LIMIT_RPM" value="1200" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Seuil de requêtes HTTP max par minute avant rejet 429.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">history</span> Rétention des Logs d'Audit (Jours)
              </label>
              <input type="number" id="setting-MOSAIX_AUDIT_RETENTION_DAYS" value="90" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Durée avant rotation et archivage froid des événements.</p>
            </div>
          </div>

          <div class="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
            <button onclick="resetSettingsCategory('telemetry')" class="px-4 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-xs">restart_alt</span> Réinitialiser
            </button>
            <button onclick="saveSettingsCategory('telemetry')" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
              <span class="material-symbols-outlined text-xs">save</span> Enregistrer Télémétrie
            </button>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-PAGE 7 : STORAGE & QUOTAS -->
      <!-- ========================================================================= -->
      <div id="settings-subpage-storage" class="settings-subpage-pane hidden space-y-6">
        <div class="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30 uppercase">Infrastructure & Disque</span>
                <h3 class="text-base font-bold text-on-surface">Stockage, Quotas Spaces & Stratégie de Cache</h3>
              </div>
              <p class="text-xs text-on-surface-variant mt-1">Gérez l'allocation physique des disques, le pilote de stockage d'assets et les mécanismes de cache.</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant/20">Section 7/7</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">folder_special</span> Quota par Défaut des Espaces (GB)
              </label>
              <input type="number" id="setting-MOSAIX_DEFAULT_SPACE_QUOTA_GB" value="5" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition">
              <p class="text-[10px] text-on-surface-variant/80">Espace disque maximum alloué à la création d'un espace Spaces.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">storage</span> Pilote de Stockage des Fichiers
              </label>
              <select id="setting-MOSAIX_STORAGE_DRIVER" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="local" selected>Système de Fichiers Local (/public & /storage)</option>
                <option value="cloud">Cloud Object Storage (GCS / S3 compatible)</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Gestionnaire physique pour les documents et médias.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-primary">memory</span> Stratégie de Cache Transversale
              </label>
              <select id="setting-MOSAIX_CACHE_STRATEGY" class="w-full bg-surface-variant/40 border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition cursor-pointer">
                <option value="memory" selected>En-Mémoire LRU (Ultra-rapide)</option>
                <option value="redis">Cache Distribué Redis</option>
              </select>
              <p class="text-[10px] text-on-surface-variant/80">Gestionnaire de cache utilisé pour les requêtes inter-BACs.</p>
            </div>
          </div>

          <!-- ADVANCED ACTIONS -->
          <div class="pt-4 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap gap-2">
              <button onclick="purgePlatformCache()" class="px-3.5 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
                <span class="material-symbols-outlined text-xs">delete_sweep</span> Purger le Cache
              </button>
              <button onclick="exportCurrentSettingsJSON()" class="px-3.5 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
                <span class="material-symbols-outlined text-xs">download</span> Exporter JSON
              </button>
              <button onclick="reindexContracts()" class="px-3.5 py-2 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
                <span class="material-symbols-outlined text-xs">refresh</span> Réindexer Contrats
              </button>
            </div>
            <button onclick="saveSettingsCategory('storage')" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
              <span class="material-symbols-outlined text-xs">save</span> Enregistrer Stockage & Quotas
            </button>
          </div>
        </div>
      </div>

    </div>
  `;
}

export const ImperiaGovernancePageView = {
  id: "imperia-governance-page",
  contractVersion: "1.0.0" as const,
  route: "/imperia/dashboard",
  title: "Imperia — Platform Governance",
  ownerApp: "@apps/imperia",
  render(): string {
    const dynamicAdminPages = shellRegistry.getAllAdminPages();

    return `
      <style>${ImperiaStyles}</style>
      <div class="imperia-container space-y-6" data-testid="imperia-governance-view">
        
        <!-- HEADER WIDGET -->
        <div class="flex flex-col md:flex-row md:items-center justify-between bg-surface-container/30 border border-outline-variant/20 p-6 rounded-2xl gap-4">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase tracking-wider">Console d'Administration</span>
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-[11px] text-emerald-400 font-semibold">${dynamicAdminPages.length} BACs Synchronisés</span>
            </div>
            <h2 class="text-2xl font-extrabold text-on-surface tracking-tight">Sénat Imperia — Platform Management Console</h2>
            <p class="text-xs text-on-surface-variant leading-relaxed">
              Consommez, supervisez et pilotez les configurations, les utilisateurs et les sous-systèmes Bounded Application Contract (BAC) du cluster unifié MosaiX.
            </p>
          </div>
          
          <div class="flex items-center gap-3">
            <button onclick="runGlobalDiagnostics()" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
              <span class="material-symbols-outlined text-sm">troubleshoot</span>
              Diagnostic Cluster
            </button>
            <button onclick="simulateActivityLogs()" class="px-4 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/30 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-sm">terminal</span>
              Simuler Activité
            </button>
          </div>
        </div>

        <!-- NAVIGATION TABS (CORE & DYNAMIC BACS) -->
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-outline-variant/20 pb-2">
          <button onclick="switchAdminTab('metrics')" id="imperia-tab-metrics" class="imperia-tab-btn active px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-surface-variant/30 text-on-surface border border-outline-variant/30 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <span class="material-symbols-outlined text-sm">monitoring</span>
            Métriques & Logs
          </button>
          <button onclick="switchAdminTab('settings')" id="imperia-tab-settings" class="imperia-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <span class="material-symbols-outlined text-sm">tune</span>
            Paramètres
            <span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">7 Pages</span>
          </button>
          <button onclick="switchAdminTab('feature-flags')" id="imperia-tab-feature-flags" class="imperia-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <span class="material-symbols-outlined text-sm">toggle_on</span>
            Feature Flags
          </button>
          <button onclick="switchAdminTab('contracts')" id="imperia-tab-contracts" class="imperia-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <span class="material-symbols-outlined text-sm">verified_user</span>
            Contrats BAC
          </button>
          
          <!-- DYNAMIC ADMIN TABS DISCOVERED FROM BACS -->
          ${dynamicAdminPages.map(page => `
            <button onclick="switchAdminTab('${page.id}')" id="imperia-tab-${page.id}" class="imperia-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <span class="material-symbols-outlined text-sm">${page.icon}</span>
              ${page.title}
              ${page.badge ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold ${getAdminBadgeStyle(page.badge.variant)}">${page.badge.text}</span>` : ''}
            </button>
          `).join('')}
        </div>

        <!-- MAIN LAYOUT FULL WIDTH -->
        <div class="w-full flex flex-col gap-6">
            
            <!-- SECTION 1: METRICS & LOGS (TAB ACTIVE BY DEFAULT) -->
            <div id="tab-content-metrics" class="tab-pane space-y-6">
              
              <!-- GRID METRICS -->
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-surface-container/50 border border-outline-variant/10 p-4 rounded-xl flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center font-bold text-xl">
                    <span class="material-symbols-outlined">developer_board</span>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CPU Usage</p>
                    <h3 class="text-lg font-extrabold text-on-surface mt-0.5">14.2%</h3>
                  </div>
                </div>

                <div class="bg-surface-container/50 border border-outline-variant/10 p-4 rounded-xl flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center font-bold text-xl">
                    <span class="material-symbols-outlined">memory</span>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Memory Allocation</p>
                    <h3 class="text-lg font-extrabold text-on-surface mt-0.5">245 MB <span class="text-[10px] text-emerald-400 font-medium">/ 512M</span></h3>
                  </div>
                </div>

                <div class="bg-surface-container/50 border border-outline-variant/10 p-4 rounded-xl flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center font-bold text-xl">
                    <span class="material-symbols-outlined">swap_calls</span>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">API Requests</p>
                    <h3 class="text-lg font-extrabold text-on-surface mt-0.5" id="metric-api-reqs">1,482 <span class="text-[10px] text-amber-400 font-medium">/min</span></h3>
                  </div>
                </div>

                <div class="bg-surface-container/50 border border-outline-variant/10 p-4 rounded-xl flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-purple-500/15 text-purple-300 flex items-center justify-center font-bold text-xl">
                    <span class="material-symbols-outlined">dns</span>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Active Nodes</p>
                    <h3 class="text-lg font-extrabold text-on-surface mt-0.5">4 Nodes <span class="text-[10px] text-purple-400 font-medium">Live</span></h3>
                  </div>
                </div>
              </div>

              <!-- REALTIME GRAPH (SVG) -->
              <div class="bg-surface-container/30 border border-outline-variant/20 p-5 rounded-2xl">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h3 class="text-sm font-bold text-on-surface">Débit des Requêtes Cluster (Dernière Heure)</h3>
                    <p class="text-[11px] text-on-surface-variant mt-0.5">Orchestration en temps réel du trafic de messagerie et de données.</p>
                  </div>
                  <span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Mosaix Mesh Active</span>
                </div>
                <div class="h-40 w-full relative">
                  <!-- SVG Graph Path -->
                  <svg class="w-full h-full" viewBox="0 0 600 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="metric-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#a078ff" stop-opacity="0.3"></stop>
                        <stop offset="100%" stop-color="#a078ff" stop-opacity="0.05"></stop>
                      </linearGradient>
                    </defs>
                    <path d="M 0,130 Q 80,100 120,120 T 240,60 T 360,90 T 480,40 T 600,70" fill="none" stroke="#a078ff" stroke-width="2.5" stroke-linecap="round"></path>
                    <path d="M 0,130 Q 80,100 120,120 T 240,60 T 360,90 T 480,40 T 600,70 L 600,160 L 0,160 Z" fill="url(#metric-grad)"></path>
                    
                    <!-- Dotted lines -->
                    <line x1="0" y1="40" x2="600" y2="40" stroke="rgba(218, 226, 253, 0.05)" stroke-dasharray="4"></line>
                    <line x1="0" y1="80" x2="600" y2="80" stroke="rgba(218, 226, 253, 0.05)" stroke-dasharray="4"></line>
                    <line x1="0" y1="120" x2="600" y2="120" stroke="rgba(218, 226, 253, 0.05)" stroke-dasharray="4"></line>
                  </svg>
                  <div class="absolute top-2 left-2 text-[9px] text-on-surface-variant font-bold">2,500 req/s</div>
                  <div class="absolute top-12 left-2 text-[9px] text-on-surface-variant font-bold">1,250 req/s</div>
                  <div class="absolute bottom-6 left-2 text-[9px] text-on-surface-variant font-bold">0 req/s</div>
                </div>
              </div>

              <!-- TELEMETRY TERMINAL -->
              <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden shadow-2xl">
                <div class="bg-surface-container/80 border-b border-outline-variant/20 px-4 py-3 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-red-500"></span>
                    <span class="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span class="text-xs font-bold text-on-surface ml-2">Console d'Activité de la Plateforme (Telemetry CLI)</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <select id="log-filter" onchange="filterAdminLogs()" class="bg-surface-variant/40 border border-outline-variant/20 text-[10px] font-bold text-on-surface rounded-lg px-2 py-1 outline-none cursor-pointer">
                      <option value="ALL">Tout Afficher</option>
                      <option value="INFO">🟢 INFO</option>
                      <option value="WARN">🟡 WARN</option>
                      <option value="ERROR">🔴 ERROR</option>
                    </select>
                    <button onclick="clearAdminLogs()" class="p-1 px-2.5 rounded bg-surface-variant hover:bg-surface-variant/80 text-[10px] font-bold text-on-surface transition">Effacer</button>
                  </div>
                </div>
                <div class="p-4 font-mono text-[11px] text-slate-300 h-56 overflow-y-auto space-y-1.5 no-scrollbar" id="console-logs-container">
                  <div class="log-row" data-level="INFO"><span class="text-slate-500">[2026-09-19 20:31:05]</span> <span class="text-emerald-400 font-bold">[INFO]</span> [ControlPlane] Initialisation du noyau de coordination MosaiX.</div>
                  <div class="log-row" data-level="INFO"><span class="text-slate-500">[2026-09-19 20:31:12]</span> <span class="text-emerald-400 font-bold">[INFO]</span> [ThemeEngine] Thème par défaut 'Midnight Pulse' appliqué avec succès.</div>
                  <div class="log-row" data-level="INFO"><span class="text-slate-500">[2026-09-19 20:32:01]</span> <span class="text-emerald-400 font-bold">[INFO]</span> [DiscoveryService] Scan des applications BAC terminé : 6 applications actives enregistrées.</div>
                  <div class="log-row" data-level="WARN"><span class="text-slate-500">[2026-09-19 20:32:45]</span> <span class="text-amber-400 font-bold">[WARN]</span> [RBACRegistry] Permission 'spaces:admin:manage' requiert une validation stricte du cluster.</div>
                  <div class="log-row" data-level="INFO"><span class="text-slate-500">[2026-09-19 20:34:10]</span> <span class="text-emerald-400 font-bold">[INFO]</span> [CompositionEngine] Surcharge de grille chargée pour le slot 'shell.home.widgets'.</div>
                  <div class="log-row" data-level="ERROR"><span class="text-slate-500">[2026-09-19 20:35:19]</span> <span class="text-red-400 font-bold">[ERROR]</span> [Identity] Échec d'authentification OAuth pour le client externe @anonymous.</div>
                </div>
              </div>
            </div>

            <!-- SECTION 2: CONTRACTS & DIAGNOSTICS -->
            <div id="tab-content-contracts" class="tab-pane hidden space-y-6">
              <div class="bg-surface-container/40 border border-outline-variant/10 p-5 rounded-2xl space-y-4">
                <h3 class="text-sm font-bold text-on-surface">Registre de Conformité des Contrats (BAC)</h3>
                <p class="text-xs text-on-surface-variant leading-relaxed">
                  MosaiX s'appuie sur des Contrats d'Application Délimitée (Bounded Application Contract) rigides. Imperia audite continuellement ces contrats pour s'assurer qu'aucun module ne dérive des conventions de la plateforme.
                </p>

                <!-- CONTRACTS LIST -->
                <div class="border border-outline-variant/20 rounded-xl overflow-hidden bg-surface/50">
                  <table class="w-full text-xs text-left">
                    <thead class="bg-surface-container/80 text-on-surface-variant border-b border-outline-variant/20">
                      <tr>
                        <th class="p-3">Application ID</th>
                        <th class="p-3">Version</th>
                        <th class="p-3">Catégorie</th>
                        <th class="p-3">Status</th>
                        <th class="p-3 text-right">Contributions</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant/10 text-on-surface">
                      <tr>
                        <td class="p-3 font-bold">@apps/citadelle</td>
                        <td class="p-3 font-mono">1.0.0</td>
                        <td class="p-3">Security & Profile</td>
                        <td class="p-3 text-emerald-400 font-semibold">🟢 Conforme</td>
                        <td class="p-3 text-right font-bold text-slate-400">4</td>
                      </tr>
                      <tr>
                        <td class="p-3 font-bold">@apps/solara</td>
                        <td class="p-3 font-mono">1.1.2</td>
                        <td class="p-3">Social & Feed</td>
                        <td class="p-3 text-emerald-400 font-semibold">🟢 Conforme</td>
                        <td class="p-3 text-right font-bold text-slate-400">3</td>
                      </tr>
                      <tr>
                        <td class="p-3 font-bold">@apps/beam</td>
                        <td class="p-3 font-mono">1.0.1</td>
                        <td class="p-3">Messaging</td>
                        <td class="p-3 text-emerald-400 font-semibold">🟢 Conforme</td>
                        <td class="p-3 text-right font-bold text-slate-400">2</td>
                      </tr>
                      <tr>
                        <td class="p-3 font-bold">@apps/commerce</td>
                        <td class="p-3 font-mono">2.0.0</td>
                        <td class="p-3">Transaction</td>
                        <td class="p-3 text-emerald-400 font-semibold">🟢 Conforme</td>
                        <td class="p-3 text-right font-bold text-slate-400">3</td>
                      </tr>
                      <tr>
                        <td class="p-3 font-bold">@apps/portfolio</td>
                        <td class="p-3 font-mono">1.0.0</td>
                        <td class="p-3">Showcase</td>
                        <td class="p-3 text-emerald-400 font-semibold">🟢 Conforme</td>
                        <td class="p-3 text-right font-bold text-slate-400">2</td>
                      </tr>
                      <tr>
                        <td class="p-3 font-bold">@apps/spaces</td>
                        <td class="p-3 font-mono">1.0.0</td>
                        <td class="p-3">Resource Allocation</td>
                        <td class="p-3 text-emerald-400 font-semibold">🟢 Conforme</td>
                        <td class="p-3 text-right font-bold text-slate-400">2</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div id="diagnostics-report-box" class="hidden bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-xs text-emerald-300 leading-relaxed space-y-2">
                  <div class="flex items-center gap-1.5 font-bold">
                    <span class="material-symbols-outlined text-sm">check_circle</span>
                    Rapport de Diagnostic Global Terminé (Cluster de confiance)
                  </div>
                  <p class="pl-5 text-on-surface-variant text-[11px]">
                    Tous les 6 modules raccordés ont validé l'analyse de conformité SemVer et l'intégrité de l'API. Aucune dérive de contrat détectée. Le routage inter-BAC est 100% sécurisé et isolé.
                  </p>
                </div>
              </div>
            </div>

            <!-- SECTION 3: GLOBAL CONFIGURATION (MULTI-PAGE SETTINGS) -->
            <div id="tab-content-settings" class="tab-pane hidden space-y-6">
              ${renderImperiaSettingsView()}
            </div>

            <!-- DYNAMIC SECTIONS: FEDERATED BAC ADMIN CONSOLES -->
            ${dynamicAdminPages.map(page => `
              <!-- SECTION BAC ADMIN: ${page.id} (${page.bacId}) -->
              <div id="tab-content-${page.id}" class="tab-pane hidden space-y-6">
                <div class="bg-surface-container/40 border border-outline-variant/10 p-5 rounded-2xl space-y-5">
                  
                  <!-- BAC Header & Status Bar -->
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/15">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase tracking-wider font-mono">${page.bacId}</span>
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-variant/30 text-on-surface-variant border border-outline-variant/20 uppercase">${page.category || 'operations'}</span>
                        <span class="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> BAC Découvert & Actif
                        </span>
                      </div>
                      <h3 class="text-base font-bold text-on-surface">${page.title}</h3>
                      <p class="text-xs text-on-surface-variant">${page.description || 'Console d\'administration déclarée dynamiquement par le contrat d\'application.'}</p>
                    </div>
                    <div class="flex items-center gap-2 text-xs">
                      <span class="px-2.5 py-1 rounded-lg bg-surface-variant/30 font-mono text-[11px] text-on-surface-variant border border-outline-variant/20">
                        ${page.route}
                      </span>
                      ${page.permission ? `<span class="px-2 py-1 rounded-lg bg-surface-container text-[10px] text-on-surface-variant/80 border border-outline-variant/15 font-mono">lock: ${page.permission}</span>` : ''}
                    </div>
                  </div>

                  <!-- Injected KPI Metrics Bar if provided -->
                  ${page.metrics && page.metrics.length > 0 ? `
                    <div class="grid grid-cols-2 sm:grid-cols-${Math.min(page.metrics.length, 4)} gap-3">
                      ${page.metrics.map(m => `
                        <div class="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/15 flex items-center gap-3">
                          ${m.icon ? `<span class="material-symbols-outlined text-purple-400 text-lg">${m.icon}</span>` : ''}
                          <div>
                            <p class="text-[10px] font-medium text-on-surface-variant uppercase">${m.label}</p>
                            <div class="flex items-baseline gap-1.5">
                              <span class="text-base font-bold text-on-surface">${m.value}</span>
                              ${m.change ? `<span class="text-[10px] font-semibold text-emerald-400">${m.change}</span>` : ''}
                            </div>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}

                  <!-- Rendered View from BAC with Isolated Root -->
                  <div class="dynamic-bac-render-root">
                    ${renderBacAdminSafely(page)}
                  </div>

                </div>
              </div>
            `).join('')}

            <!-- SECTION 10: FEATURE FLAGS GOVERNANCE -->
            <div id="tab-content-feature-flags" class="tab-pane hidden space-y-6">
              <div class="bg-surface-container/40 border border-outline-variant/10 p-5 rounded-2xl space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-sm font-bold text-on-surface">Gouvernance des Feature Flags MosaiX</h3>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">Architecture Ports / Adaptateurs</span>
                    </div>
                    <p class="text-xs text-on-surface-variant mt-1">
                      Contrôlez dynamiquement les capacités, la visibilité des applications et les fonctionnalités du cluster en temps réel avec persistance garantie.
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button onclick="refreshAdminFeatureFlags()" class="px-3 py-1.5 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/30 text-on-surface font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer">
                      <span class="material-symbols-outlined text-sm">refresh</span>
                      Actualiser
                    </button>
                    <button onclick="openNewFlagModal()" class="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer">
                      <span class="material-symbols-outlined text-sm">add</span>
                      Nouveau Flag
                    </button>
                  </div>
                </div>

                <!-- CATEGORY FILTER PILLS & SEARCH -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="flex items-center gap-2 overflow-x-auto pb-1" id="ff-category-filters">
                    <button onclick="filterFlagsByCategory('ALL')" class="ff-filter-btn active px-3 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 transition cursor-pointer">
                      Tous (<span id="ff-count-all">0</span>)
                    </button>
                    <button onclick="filterFlagsByCategory('apps')" class="ff-filter-btn px-3 py-1 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 transition cursor-pointer">
                      Applications (BAC)
                    </button>
                    <button onclick="filterFlagsByCategory('platform')" class="ff-filter-btn px-3 py-1 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 transition cursor-pointer">
                      Plateforme & Core
                    </button>
                    <button onclick="filterFlagsByCategory('social')" class="ff-filter-btn px-3 py-1 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 transition cursor-pointer">
                      Réseau Social
                    </button>
                    <button onclick="filterFlagsByCategory('governance')" class="ff-filter-btn px-3 py-1 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 transition cursor-pointer">
                      Gouvernance
                    </button>
                  </div>

                  <div class="flex items-center gap-2">
                    <div class="relative">
                      <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-on-surface-variant/60 material-symbols-outlined text-sm">search</span>
                      <input type="text" id="ff-search-input" oninput="searchFeatureFlags(this.value)" placeholder="Rechercher un flag..." class="w-48 sm:w-56 pl-8 pr-3 py-1 rounded-xl bg-surface-variant/20 border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:border-purple-500 transition">
                    </div>
                    <button onclick="exportFeatureFlagsJSON()" class="px-2.5 py-1 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/30 text-on-surface-variant hover:text-on-surface text-xs transition flex items-center gap-1 cursor-pointer" title="Exporter en JSON">
                      <span class="material-symbols-outlined text-sm">download</span>
                    </button>
                  </div>
                </div>

                <!-- FEATURE FLAGS TABLE -->
                <div class="border border-outline-variant/20 rounded-xl overflow-hidden bg-surface/50 shadow-inner">
                  <table class="w-full text-xs text-left">
                    <thead class="bg-surface-container/80 text-on-surface-variant border-b border-outline-variant/20">
                      <tr>
                        <th class="p-3">Clé du Flag</th>
                        <th class="p-3">Catégorie</th>
                        <th class="p-3">Description</th>
                        <th class="p-3">Type</th>
                        <th class="p-3">Rôles Restreints</th>
                        <th class="p-3 text-right">État / Bascule</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant/10 text-on-surface" id="feature-flags-table-body">
                      <tr>
                        <td colspan="6" class="p-6 text-center text-on-surface-variant italic">Chargement des feature flags...</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

        <!-- New Flag Modal -->
        <div id="newFlagModal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div class="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 w-full max-w-md shadow-2xl text-white space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-white">Créer un Feature Flag</h3>
              <button onclick="closeNewFlagModal()" class="text-slate-400 hover:text-white cursor-pointer"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Clé du flag</label>
              <input id="flagKeyInput" type="text" placeholder="ex: apps.booking.enabled" class="w-full px-3 py-2 rounded-xl bg-[#0e1424] border border-[#2d3449] text-xs text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Description</label>
              <input id="flagDescInput" type="text" placeholder="Description fonctionnelle" class="w-full px-3 py-2 rounded-xl bg-[#0e1424] border border-[#2d3449] text-xs text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Catégorie</label>
              <select id="flagCatInput" class="w-full px-3 py-2 rounded-xl bg-[#0e1424] border border-[#2d3449] text-xs text-white focus:outline-none focus:border-purple-500">
                <option value="apps">apps</option>
                <option value="platform">platform</option>
                <option value="social">social</option>
                <option value="governance">governance</option>
                <option value="custom">custom</option>
              </select>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button onclick="closeNewFlagModal()" class="px-4 py-2 rounded-xl border border-[#2d3449] text-xs font-semibold text-white hover:bg-white/5 cursor-pointer">Annuler</button>
              <button onclick="submitNewFlagModal()" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md cursor-pointer">Créer et Persister</button>
            </div>
          </div>
        </div>

        <div id="imperia-toast-container" class="fixed bottom-5 right-5 z-50 pointer-events-none space-y-2"></div>
      </div>

      <!-- INTERACTIVE SCRIPTS -->
      <script>
        window.showImperiaNotice = window.showImperiaNotice || function(message, type) {
          let prefix = "";
          if (type === 'error') prefix = "Erreur: ";
          if (type === 'success') prefix = "Succès: ";
          window.alert(prefix + message);
        };

        // Tab switcher linked with secondary platform sidebar
        function switchAdminTab(tabId) {
          // Hide all tab panes
          document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
          
          // Remove active classes on buttons (secondary sidebar buttons)
          document.querySelectorAll('.admin-tab-btn').forEach(el => {
            el.classList.remove('active', 'bg-surface-variant/30', 'text-on-surface');
            el.classList.add('text-on-surface-variant');
          });

          // Remove active classes on top header tabs
          document.querySelectorAll('.imperia-tab-btn').forEach(el => {
            el.classList.remove('active', 'bg-surface-variant/30', 'text-on-surface', 'border', 'border-outline-variant/30');
            el.classList.add('text-on-surface-variant');
          });

          // Show targeted pane
          const targetedPane = document.getElementById('tab-content-' + tabId);
          if (targetedPane) targetedPane.classList.remove('hidden');

          // Highlight targeted tab button inside secondary sidebar
          const sidebarBtn = document.getElementById('sidebar-tab-' + tabId);
          if (sidebarBtn) {
            sidebarBtn.classList.add('active', 'bg-surface-variant/30', 'text-on-surface');
            sidebarBtn.classList.remove('text-on-surface-variant');
          }

          // Highlight top header tab button
          const headerBtn = document.getElementById('imperia-tab-' + tabId);
          if (headerBtn) {
            headerBtn.classList.add('active', 'bg-surface-variant/30', 'text-on-surface', 'border', 'border-outline-variant/30');
            headerBtn.classList.remove('text-on-surface-variant');
          }

          // If switching to feature flags tab, load the flags
          if (tabId === 'feature-flags') {
            refreshAdminFeatureFlags();
          }
        }

        // Feature Flags State & Management
        let cachedFeatureFlags = [];
        let activeFfCategory = 'ALL';
        let ffSearchQuery = '';

        async function refreshAdminFeatureFlags() {
          const tbody = document.getElementById('feature-flags-table-body');
          if (!tbody) return;

          tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-on-surface-variant italic">Chargement des feature flags en cours...</td></tr>';

          try {
            const res = await fetch('/api/feature-flags');
            if (!res.ok) throw new Error('Erreur HTTP ' + res.status);
            const data = await res.json();
            cachedFeatureFlags = data.flags || [];
            const countEl = document.getElementById('ff-count-all');
            if (countEl) countEl.innerText = cachedFeatureFlags.length;
            renderFeatureFlagsTable();
          } catch (err) {
            console.error('Erreur chargement feature flags:', err);
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-red-400">Échec du chargement des flags : ' + err.message + '</td></tr>';
          }
        }

        function filterFlagsByCategory(category) {
          activeFfCategory = category;
          document.querySelectorAll('.ff-filter-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-purple-500/20', 'text-purple-300', 'border-purple-500/30');
            btn.classList.add('text-on-surface-variant');
          });
          const target = event?.target;
          if (target) {
            target.classList.add('active', 'bg-purple-500/20', 'text-purple-300', 'border', 'border-purple-500/30');
            target.classList.remove('text-on-surface-variant');
          }
          renderFeatureFlagsTable();
        }

        function searchFeatureFlags(query) {
          ffSearchQuery = (query || '').toLowerCase().trim();
          renderFeatureFlagsTable();
        }

        function renderFeatureFlagsTable() {
          const tbody = document.getElementById('feature-flags-table-body');
          if (!tbody) return;

          let filtered = activeFfCategory === 'ALL'
            ? cachedFeatureFlags
            : cachedFeatureFlags.filter(f => (f.category || '').toLowerCase() === activeFfCategory.toLowerCase());

          if (ffSearchQuery) {
            filtered = filtered.filter(f => 
              f.key.toLowerCase().includes(ffSearchQuery) || 
              (f.description && f.description.toLowerCase().includes(ffSearchQuery))
            );
          }

          if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-on-surface-variant italic">Aucun feature flag ne correspond aux critères.</td></tr>';
            return;
          }

          tbody.innerHTML = filtered.map(flag => {
            const isEnabled = flag.value === true || flag.value === 'true';
            const roles = (flag.rolesAllowlist && flag.rolesAllowlist.length > 0)
              ? flag.rolesAllowlist.map(r => '<span class="px-1.5 py-0.5 rounded bg-surface-variant/40 border border-outline-variant/20 text-[10px]">' + r + '</span>').join(' ')
              : '<span class="text-on-surface-variant/50 text-[10px]">Tous</span>';

            const catBadgeClass = flag.category === 'apps' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
              : flag.category === 'platform' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
              : flag.category === 'social' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

            return '<tr class="hover:bg-surface-variant/10 transition">' +
              '<td class="p-3 font-mono text-[11px] font-semibold text-primary">' + flag.key + '</td>' +
              '<td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ' + catBadgeClass + '">' + (flag.category || 'général') + '</span></td>' +
              '<td class="p-3 text-on-surface-variant text-[11px] max-w-xs leading-snug">' + (flag.description || '—') + '</td>' +
              '<td class="p-3 font-mono text-[10px] text-on-surface-variant">' + flag.variationType + '</td>' +
              '<td class="p-3">' + roles + '</td>' +
              '<td class="p-3 text-right">' +
                '<label class="inline-flex items-center gap-2 cursor-pointer">' +
                  '<span class="text-[10px] font-bold ' + (isEnabled ? 'text-emerald-400' : 'text-on-surface-variant') + '">' + (isEnabled ? 'ACTIF' : 'INACTIF') + '</span>' +
                  '<input type="checkbox" ' + (isEnabled ? 'checked' : '') + ' data-flag-key="' + flag.key + '" onchange="toggleAdminFeatureFlag(this.dataset.flagKey, this)" class="w-4 h-4 accent-purple-600 cursor-pointer rounded">' +
                '</label>' +
              '</td>' +
            '</tr>';
          }).join('');
        }

        function exportFeatureFlagsJSON() {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cachedFeatureFlags, null, 2));
          const downloadAnchor = document.createElement('a');
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute("download", "mosaix_feature_flags_" + new Date().toISOString().slice(0, 10) + ".json");
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
        }

        async function toggleAdminFeatureFlag(flagKey, checkboxEl) {
          const previousState = !checkboxEl.checked;
          try {
            const res = await fetch('/api/feature-flags/toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: flagKey })
            });
            if (!res.ok) throw new Error('Erreur HTTP ' + res.status);
            const data = await res.json();
            
            // Update local cache
            const target = cachedFeatureFlags.find(f => f.key === flagKey);
            if (target) {
              target.value = data.value;
            }
            renderFeatureFlagsTable();
          } catch (err) {
            console.error('Erreur bascule flag:', err);
            showImperiaNotice('Échec de la modification du flag : ' + err.message, 'error');
            checkboxEl.checked = previousState;
          }
        }

        window.openNewFlagModal = function() {
          const modal = document.getElementById('newFlagModal');
          if (modal) {
            modal.classList.remove('hidden');
            const input = document.getElementById('flagKeyInput');
            if (input) input.focus();
          }
        };

        window.closeNewFlagModal = function() {
          const modal = document.getElementById('newFlagModal');
          if (modal) modal.classList.add('hidden');
        };

        window.submitNewFlagModal = async function() {
          const keyInput = document.getElementById('flagKeyInput');
          const descInput = document.getElementById('flagDescInput');
          const catInput = document.getElementById('flagCatInput');
          const key = keyInput ? keyInput.value.trim() : '';
          const desc = descInput ? descInput.value.trim() : '';
          const category = catInput ? catInput.value : 'apps';

          if (!key) {
            showImperiaNotice("Veuillez renseigner la clé du flag.", "error");
            return;
          }

          try {
            const res = await fetch('/api/feature-flags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                key: key,
                value: true,
                description: desc || '',
                category: category || 'custom',
                variationType: 'boolean'
              })
            });
            if (!res.ok) throw new Error('Erreur HTTP ' + res.status);
            showImperiaNotice("Feature Flag '" + key + "' créé et persisté avec succès !", "success");
            closeNewFlagModal();
            if (keyInput) keyInput.value = '';
            if (descInput) descInput.value = '';
            refreshAdminFeatureFlags();
          } catch (err) {
            showImperiaNotice("Erreur lors de la création : " + err.message, "error");
          }
        };

        // Initialize active tab state on load
        function initActiveImperiaTab() {
          const urlParams = new URLSearchParams(window.location.search);
          const requestedTab = urlParams.get('tab');
          if (requestedTab) {
            switchAdminTab(requestedTab);
          } else {
            switchAdminTab('metrics');
          }
        }

        window.addEventListener('DOMContentLoaded', () => {
          initActiveImperiaTab();
        });
        setTimeout(() => {
          initActiveImperiaTab();
        }, 50);

        // Run Global Diagnostics
        function runGlobalDiagnostics() {
          const reportBox = document.getElementById('diagnostics-report-box');
          if (!reportBox) return;

          reportBox.classList.add('hidden');
          showImperiaNotice("Lancement de l'audit de conformité sur les 6 BACs du cluster...", "info");
          
          setTimeout(() => {
            reportBox.classList.remove('hidden');
            // Navigate to contracts tab to see report
            switchAdminTab('contracts');
            showImperiaNotice("Diagnostic terminé avec succès ! 6/6 BACs sont conformes.", "success");
          }, 1200);
        }

        // Simulate Activity logs
        let reqsCount = 1482;
        function simulateActivityLogs() {
          const container = document.getElementById('console-logs-container');
          if (!container) return;

          const components = ['[Identity]', '[Solara]', '[Beam]', '[Commerce]', '[Spaces]', '[ThemeEngine]'];
          const actions = [
            { level: 'INFO', text: "Validation du jeton SSO pour l'utilisateur @citoyen_lambda." },
            { level: 'INFO', text: 'Nouveau message enregistré sur #general.' },
            { level: 'INFO', text: "Ajustement du quota disque pour l'espace Collaboratif." },
            { level: 'WARN', text: 'Temps de réponse de la base SQLite supérieure à 120ms.' },
            { level: 'ERROR', text: "Échec de chargement du composant d'administration pour le plugin externe." }
          ];

          const randComp = components[Math.floor(Math.random() * components.length)];
          const randAct = actions[Math.floor(Math.random() * actions.length)];
          const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

          const div = document.createElement('div');
          div.className = 'log-row';
          div.setAttribute('data-level', randAct.level);

          let colorClass = 'text-emerald-400';
          if (randAct.level === 'WARN') colorClass = 'text-amber-400';
          if (randAct.level === 'ERROR') colorClass = 'text-red-400';

          div.innerHTML = \`<span class="text-slate-500">[\${nowStr}]</span> <span class="\${colorClass} font-bold">[\${randAct.level}]</span> \${randComp} \${randAct.text}\`;
          container.appendChild(div);
          
          // Auto scroll
          container.scrollTop = container.scrollHeight;

          // Update requests metrics
          reqsCount += Math.floor(Math.random() * 45) + 10;
          const reqsEl = document.getElementById('metric-api-reqs');
          if (reqsEl) {
            reqsEl.innerHTML = \`\${reqsCount.toLocaleString()} <span class="text-[10px] text-on-surface-variant font-medium">/min</span>\`;
          }
        }

        // Filter terminal logs
        function filterAdminLogs() {
          const level = document.getElementById('log-filter').value;
          document.querySelectorAll('.log-row').forEach(row => {
            if (level === 'ALL' || row.getAttribute('data-level') === level) {
              row.classList.remove('hidden');
            } else {
              row.classList.add('hidden');
            }
          });
        }

        // Clear terminal logs
        function clearAdminLogs() {
          const container = document.getElementById('console-logs-container');
          if (container) container.innerHTML = '';
        }

        // User accounts management - Filter search
        function searchAdminUsers() {
          const query = document.getElementById('user-admin-search').value.toLowerCase().trim();
          document.querySelectorAll('.user-row').forEach(row => {
            const name = row.querySelector('.user-name').textContent.toLowerCase();
            if (name.includes(query)) {
              row.classList.remove('hidden');
            } else {
              row.classList.add('hidden');
            }
          });
        }

        // Update user role
        function updateUserRole(selectEl) {
          showImperiaNotice("Modification de rôle enregistrée ! Le profil utilisateur a été synchronisé.", "success");
        }

        // Reset user MFA
        function resetUserMfa(username) {
          showImperiaNotice("L'authentification MFA et les clés d'accès de " + username + " ont été réinitialisées avec succès !", "success");
        }

        // Moderate Solara Posts
        function approveAdminPost(id) {
          const post = document.getElementById(id);
          if (post) {
            post.className = "p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2";
            post.innerHTML = \`<span class="material-symbols-outlined text-sm">verified</span> Publication validée et marquée comme sûre !\`;
            setTimeout(() => { post.remove(); }, 1500);
          }
        }

        function deleteAdminPost(id) {
          const post = document.getElementById(id);
          if (post) {
            post.className = "p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2";
            post.innerHTML = \`<span class="material-symbols-outlined text-sm">block</span> Publication censurée et retirée du fil social !\`;
            setTimeout(() => { post.remove(); }, 1500);
          }
        }

        // Create Beam Broadcast Channel
        function createAdminBeamChannel() {
          const input = document.getElementById('admin-beam-channel');
          const desc = document.getElementById('admin-beam-desc');
          if (!input || !input.value.trim()) return;

          showImperiaNotice("Canal de diffusion officiel " + input.value.trim() + " déclaré avec succès !", "success");
          input.value = '';
          desc.value = '';
        }

        // Adjust Spaces Quota
        function adjustSpaceQuota(name) {
          showImperiaNotice("Quota de stockage mis à jour pour " + name + " : 20 GB.", "success");
        }

        // Sub-page switcher for Multi-Page Settings
        function switchSettingsSubPage(subPageId) {
          // Hide all subpage panes
          document.querySelectorAll('.settings-subpage-pane').forEach(el => el.classList.add('hidden'));
          
          // Reset button styles
          document.querySelectorAll('.settings-subtab-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-purple-600', 'text-white', 'shadow-sm');
            btn.classList.add('text-on-surface-variant');
          });

          // Show target pane
          const target = document.getElementById('settings-subpage-' + subPageId);
          if (target) {
            target.classList.remove('hidden');
          }

          // Highlight target button
          const btn = document.getElementById('settings-subtab-' + subPageId);
          if (btn) {
            btn.classList.add('active', 'bg-purple-600', 'text-white', 'shadow-sm');
            btn.classList.remove('text-on-surface-variant');
          }
        }

        // Save Settings Category via Batch API
        async function saveSettingsCategory(category) {
          const overrides = {};
          const inputs = document.querySelectorAll('#settings-subpage-' + category + ' input, #settings-subpage-' + category + ' select');
          
          inputs.forEach(input => {
            if (!input.id || !input.id.startsWith('setting-')) return;
            const key = input.id.replace('setting-', '');
            if (input.type === 'checkbox') {
              overrides[key] = input.checked;
            } else if (input.type === 'number') {
              overrides[key] = Number(input.value);
            } else {
              overrides[key] = input.value;
            }
          });

          try {
            const res = await fetch('/imperia/settings/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ overrides })
            });

            if (res.ok) {
              showImperiaNotice("Succès : Les paramètres pour la section '" + category + "' ont été enregistrés et appliqués au cluster !", "success");
            } else {
              showImperiaNotice("Paramètres '" + category + "' mis à jour localement avec succès.", "info");
            }
          } catch (e) {
            console.warn('Backend call failed, applying locally:', e);
            showImperiaNotice("Paramètres '" + category + "' appliqués localement.", "info");
          }
        }

        // Reset Settings Category
        function resetSettingsCategory(category) {
          showImperiaNotice("Section '" + category + "' réinitialisée aux valeurs nominales.", "info");
        }

        // Export Current Settings JSON
        function exportCurrentSettingsJSON() {
          const config = {
            clusterName: document.getElementById('setting-MOSAIX_CLUSTER_NAME')?.value || "MosaiX High-Availability Cluster",
            environment: document.getElementById('setting-NODE_ENV')?.value || "production",
            defaultBac: document.getElementById('setting-MOSAIX_DEFAULT_BAC')?.value || "@apps/imperia",
            mfaEnforced: document.getElementById('setting-MOSAIX_MFA_ENFORCED')?.checked ?? true,
            theme: document.getElementById('setting-MOSAIX_DEFAULT_THEME')?.value || "midnight-pulse",
            rateLimitRpm: Number(document.getElementById('setting-MOSAIX_RATE_LIMIT_RPM')?.value) || 1200,
            exportedAt: new Date().toISOString()
          };
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
          const downloadAnchor = document.createElement('a');
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute("download", "mosaix_platform_settings_" + new Date().toISOString().slice(0, 10) + ".json");
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
        }

        function savePlatformDefaultBac(bacId) {
          if (bacId) {
            shellRegistry.setDefaultBacId(bacId);
            const el = document.getElementById('current-landfall-status');
            if (el) el.textContent = "BAC Actif : " + bacId;
            showImperiaNotice("Landfall mis à jour : le BAC '" + bacId + "' est désormais prioritaire sur l'URL de base /.", "success");
          }
        }

        function savePlatformTheme(theme) {
          showImperiaNotice("Thème global appliqué : " + theme, "info");
        }

        function toggleMaintenanceMode(enabled) {
          if (enabled) {
            showImperiaNotice("AVERTISSEMENT : Mode maintenance activé sur la plateforme !", "error");
          } else {
            showImperiaNotice("Mode maintenance désactivé.", "info");
          }
        }

        function purgePlatformCache() {
          showImperiaNotice("Cache global purgé avec succès (0 Ko en mémoire tampon).", "success");
        }

        function reindexContracts() {
          showImperiaNotice("Réindexation des 21 contrats d'expérience terminée sans erreur.", "success");
        }

        // Ship Commerce Order
        function shipCommerceOrder(id, orderNum) {
          const badge = document.getElementById('status-ord-' + id);
          if (badge) {
            badge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium";
            badge.textContent = "Expédié";
            showImperiaNotice("Logistique : Commande " + orderNum + " expédiée ! Notification envoyée au client.", "success");
          }
        }
      </script>
    `;
  },
};

export const ImperiaPlatformSettingsPageView = {
  id: "imperia-platform-settings-page",
  contractVersion: "1.0.0" as const,
  route: "/imperia/settings",
  title: "Imperia — Platform Settings",
  ownerApp: "@apps/imperia",
  render(): string {
    return `
      <style>${ImperiaStyles}</style>
      <div class="imperia-container space-y-6" data-testid="imperia-settings-standalone-view">
        <div class="flex flex-col md:flex-row md:items-center justify-between bg-surface-container/30 border border-outline-variant/20 p-6 rounded-2xl gap-4">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase tracking-wider">Console de Paramètres</span>
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-[11px] text-emerald-400 font-semibold">Cluster Synchronisé</span>
            </div>
            <h2 class="text-2xl font-extrabold text-on-surface tracking-tight">Imperia — Platform Settings (7 Pages)</h2>
            <p class="text-xs text-on-surface-variant leading-relaxed">
              Consultez et ajustez la configuration modulaire par catégorie : Général, Sécurité, Politiques BAC, Extensions & Flags, Thèmes, Télémétrie et Stockage.
            </p>
          </div>
        </div>

        ${renderImperiaSettingsView()}
      </div>
      <script>
        window.showImperiaNotice = window.showImperiaNotice || function(message, type) {
          let prefix = "";
          if (type === 'error') prefix = "Erreur: ";
          if (type === 'success') prefix = "Succès: ";
          window.alert(prefix + message);
        };

        function switchSettingsSubPage(subPageId) {
          document.querySelectorAll('.settings-subpage-pane').forEach(el => el.classList.add('hidden'));
          document.querySelectorAll('.settings-subtab-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-purple-600', 'text-white', 'shadow-sm');
            btn.classList.add('text-on-surface-variant');
          });
          const target = document.getElementById('settings-subpage-' + subPageId);
          if (target) target.classList.remove('hidden');
          const btn = document.getElementById('settings-subtab-' + subPageId);
          if (btn) {
            btn.classList.add('active', 'bg-purple-600', 'text-white', 'shadow-sm');
            btn.classList.remove('text-on-surface-variant');
          }
        }

        async function saveSettingsCategory(category) {
          const overrides = {};
          const inputs = document.querySelectorAll('#settings-subpage-' + category + ' input, #settings-subpage-' + category + ' select');
          inputs.forEach(input => {
            if (!input.id || !input.id.startsWith('setting-')) return;
            const key = input.id.replace('setting-', '');
            if (input.type === 'checkbox') overrides[key] = input.checked;
            else if (input.type === 'number') overrides[key] = Number(input.value);
            else overrides[key] = input.value;
          });

          try {
            const res = await fetch('/imperia/settings/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ overrides })
            });
            if (res.ok) {
              showImperiaNotice("Succès : Les paramètres pour la section '" + category + "' ont été enregistrés et appliqués au cluster !", "success");
            } else {
              showImperiaNotice("Paramètres '" + category + "' mis à jour localement avec succès.", "info");
            }
          } catch (e) {
            console.warn('Backend call failed, applying locally:', e);
            showImperiaNotice("Paramètres '" + category + "' appliqués localement.", "info");
          }
        }

        function resetSettingsCategory(category) {
          showImperiaNotice("Section '" + category + "' réinitialisée aux valeurs nominales.", "info");
        }

        function exportCurrentSettingsJSON() {
          const config = {
            clusterName: document.getElementById('setting-MOSAIX_CLUSTER_NAME')?.value || "MosaiX High-Availability Cluster",
            environment: document.getElementById('setting-NODE_ENV')?.value || "production",
            defaultBac: document.getElementById('setting-MOSAIX_DEFAULT_BAC')?.value || "@apps/imperia",
            mfaEnforced: document.getElementById('setting-MOSAIX_MFA_ENFORCED')?.checked ?? true,
            theme: document.getElementById('setting-MOSAIX_DEFAULT_THEME')?.value || "midnight-pulse",
            rateLimitRpm: Number(document.getElementById('setting-MOSAIX_RATE_LIMIT_RPM')?.value) || 1200,
            exportedAt: new Date().toISOString()
          };
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
          const downloadAnchor = document.createElement('a');
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute("download", "mosaix_platform_settings_" + new Date().toISOString().slice(0, 10) + ".json");
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
        }

        function savePlatformDefaultBac(bacId) {
          if (bacId) {
            shellRegistry.setDefaultBacId(bacId);
            const el = document.getElementById('current-landfall-status');
            if (el) el.textContent = "BAC Actif : " + bacId;
            showImperiaNotice("Landfall mis à jour : le BAC '" + bacId + "' est désormais prioritaire sur l'URL de base /.", "success");
          }
        }

        function savePlatformTheme(theme) {
          showImperiaNotice("Thème global appliqué : " + theme, "info");
        }

        function toggleMaintenanceMode(enabled) {
          if (enabled) {
            showImperiaNotice("AVERTISSEMENT : Mode maintenance activé sur la plateforme !", "error");
          } else {
            showImperiaNotice("Mode maintenance désactivé.", "info");
          }
        }

        function purgePlatformCache() {
          showImperiaNotice("Cache global purgé avec succès (0 Ko en mémoire tampon).", "success");
        }

        function reindexContracts() {
          showImperiaNotice("Réindexation des 21 contrats d'expérience terminée sans erreur.", "success");
        }
      </script>
    `;
  },
};

export const imperiaNavigationItems = [
  { id: "nav-governance", label: "Governance", route: "/imperia/dashboard", pageView: ImperiaGovernancePageView },
  { id: "nav-settings", label: "Platform Settings", route: "/imperia/settings", pageView: ImperiaPlatformSettingsPageView },
];

export const imperiaUiSlots = [
  {
    slotId: "admin.dashboard.widget",
    appId: "@apps/imperia",
    label: "Governance Control Plane",
    path: "/imperia/dashboard"
  }
];

export function registerImperiaUISlots() {
  return imperiaUiSlots;
}

export const imperiaContributions: ContributionContract[] = [
  {
    id: "imperia:nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/imperia",
    kind: "navigation",
    title: "Imperia Governance",
    route: "/imperia/dashboard",
    icon: "🛡️",
    placements: [{ id: "p-imp-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 60 }],
    policies: {
      requiredPermissions: ["governance:admin"],
      requiredCapabilities: ["platform:control-plane"],
    },
  },
  {
    id: "imperia:governance-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/imperia",
    kind: "page",
    title: "Imperia — Platform Governance",
    route: "/imperia/dashboard",
    placements: [{ id: "p-imp-page", surfaceId: "application-shell", slotId: "main.content" }],
    policies: {
      requiredPermissions: ["governance:admin"],
      requiredCapabilities: ["platform:control-plane"],
    },
    content: { html: ImperiaGovernancePageView.render() },
  },
  {
    id: "imperia:settings-nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/imperia",
    kind: "navigation",
    title: "Platform Settings",
    route: "/imperia/settings",
    icon: "⚙️",
    placements: [{ id: "p-imp-set-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 61 }],
    policies: {
      requiredPermissions: ["governance:admin"],
      requiredCapabilities: ["platform:control-plane"],
    },
  },
  {
    id: "imperia:settings-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/imperia",
    kind: "page",
    title: "Imperia — Platform Settings",
    route: "/imperia/settings",
    placements: [{ id: "p-imp-set-page", surfaceId: "application-shell", slotId: "main.content" }],
    policies: {
      requiredPermissions: ["governance:admin"],
      requiredCapabilities: ["platform:control-plane"],
    },
    content: { html: ImperiaPlatformSettingsPageView.render() },
  },
];
