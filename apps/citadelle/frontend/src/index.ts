import type { ContributionContract } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

shellRegistry.registerAdminPage({
  id: "identity-admin-users",
  bacId: "@apps/citadelle",
  title: "Utilisateurs & IAM",
  description: "Gestion des comptes d'accès, permissions et jetons SSO",
  icon: "manage_accounts",
  route: "/identity/admin/users",
  category: "identity",
  permission: "identity:admin:users",
  order: 10,
  badge: { text: "2 Actifs", variant: "primary" },
  metrics: [
    { id: "active-users", label: "Utilisateurs Actifs", value: 24, status: "nominal", icon: "person" },
    { id: "mfa-rate", label: "Couverture MFA", value: "92%", status: "nominal", icon: "verified" },
  ],
  render: () => IdentityAdminUsersPageView.render()
});

export const IdentityStyles = `
  .identity-auth-card {
    max-width: 440px; margin: 40px auto; background: var(--bg-card, #141414);
    border: 1px solid var(--border, #222); border-radius: 16px; padding: 32px;
    box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.4)); font-family: 'Inter', sans-serif;
  }
  .identity-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .identity-avatar {
    width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.1rem;
  }
  .identity-auth-card h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 6px; color: var(--text-primary, #f5f5f5); }
  .identity-auth-card p { font-size: 0.85rem; color: var(--text-muted, #666); margin-bottom: 20px; }
  .identity-field { margin-bottom: 16px; }
  .identity-field label { display: block; font-size: 0.8rem; font-weight: 500; color: var(--text-secondary, #a0a0a0); margin-bottom: 6px; }
  .identity-field input {
    width: 100%; height: 40px; background: var(--bg-tertiary, #1a1a1a); border: 1px solid var(--border, #222);
    border-radius: 8px; padding: 0 12px; font-size: 0.9rem; color: var(--text-primary, #f5f5f5); outline: none;
    transition: all 0.2s ease;
  }
  .identity-field input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
  .identity-btn {
    width: 100%; height: 42px; background: #6366f1; border: none; border-radius: 8px; color: white;
    font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; margin-top: 8px;
  }
  .identity-btn:hover { background: #4f46e5; transform: translateY(-1px); }
`;

export const IdentityLoginPageView = {
  id: "identity-login-page",
  contractVersion: "1.0.0" as const,
  route: "/login",
  title: "Identity — Login",
  ownerApp: "@apps/citadelle",
  render(): string {
    return `
      <style>${IdentityStyles}</style>
      <div class="identity-auth-card" data-testid="identity-login-view">
        <div class="identity-brand">
          <div class="identity-avatar">ID</div>
          <div>
            <h2>MosaiX Single Sign-On</h2>
            <p>Access all Bounded Applications across the platform</p>
          </div>
        </div>
        <form id="login-form">
          <div class="identity-field">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" placeholder="user@mosaix.com" required />
          </div>
          <div class="identity-field">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="••••••••" required />
          </div>
          <button type="submit" class="identity-btn">Sign In to Platform</button>
        </form>
      </div>
    `;
  },
};

export const IdentityRegisterPageView = {
  id: "identity-register-page",
  contractVersion: "1.0.0" as const,
  route: "/register",
  title: "Identity — Register Account",
  ownerApp: "@apps/citadelle",
  render(): string {
    return `
      <style>${IdentityStyles}</style>
      <div class="identity-auth-card" data-testid="identity-register-view">
        <div class="identity-brand">
          <div class="identity-avatar">ID</div>
          <div>
            <h2>Create Platform Account</h2>
            <p>Join MosaiX and unlock all domain capabilities</p>
          </div>
        </div>
        <form id="register-form">
          <div class="identity-field">
            <label for="displayName">Display Name</label>
            <input type="text" id="displayName" name="displayName" placeholder="Jean Dupont" required />
          </div>
          <div class="identity-field">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" placeholder="user@mosaix.com" required />
          </div>
          <div class="identity-field">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="••••••••" required />
          </div>
          <button type="submit" class="identity-btn">Register Account</button>
        </form>
      </div>
    `;
  },
};

export const IdentityAdminUsersPageView = {
  id: "identity-admin-users-page",
  contractVersion: "1.0.0" as const,
  route: "/identity/admin/users",
  title: "Identity — User Administration",
  ownerApp: "@apps/citadelle",
  render(): string {
    return `
      <style>${IdentityStyles}</style>
      <div class="identity-auth-card" style="max-width: 800px;">
        <h2>User Administration</h2>
        <p>Manage platform users, roles, and permissions.</p>
        <div style="background: #1a1a1a; padding: 16px; border-radius: 8px; border: 1px solid #222;">
          <table style="width: 100%; text-align: left; font-size: 0.9rem; color: #f5f5f5;">
            <thead>
              <tr style="border-bottom: 1px solid #333;">
                <th style="padding: 8px;">User</th>
                <th style="padding: 8px;">Role</th>
                <th style="padding: 8px;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding: 8px;">Admin User</td><td style="padding: 8px;">Administrator</td><td style="padding: 8px;">Active</td></tr>
              <tr><td style="padding: 8px;">Regular User</td><td style="padding: 8px;">Member</td><td style="padding: 8px;">Active</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
};

export const IdentityGdprPrivacyPageView = {
  id: "identity-gdpr-privacy-page",
  contractVersion: "1.0.0" as const,
  route: "/identity/privacy",
  title: "Identity — Confidentialité & Droit à l'Oubli (RGPD)",
  ownerApp: "@apps/citadelle",
  render(): string {
    return `
      <style>${IdentityStyles}</style>
      <div class="identity-auth-card" style="max-width: 680px;" data-testid="identity-gdpr-view">
        <div class="identity-brand">
          <div class="identity-avatar" style="background: linear-gradient(135deg, #ef4444, #dc2626);">🛡️</div>
          <div>
            <h2>Protection des Données & RGPD</h2>
            <p>Gestion de vos données personnelles et droit à l'effacement</p>
          </div>
        </div>
        
        <div class="space-y-4 text-xs text-on-surface-variant leading-relaxed" style="color: #bbb;">
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD - Art. 17), vous disposez du droit d'obtenir l'effacement irréversible de l'ensemble de vos données personnelles sur la plateforme MosaiX et l'ensemble de ses Bounded Applications (Citadelle, Solara, Beam, Commerce, Booking, Portfolio).
          </p>

          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin: 16px 0;">
            <h4 style="color: #f87171; font-weight: bold; margin-bottom: 6px;">⚠️ Conséquences de l'anonymisation</h4>
            <ul style="list-style: disc; padding-left: 18px; space-y: 4px;">
              <li>Vos identifiants, mot de passe et sessions seront immédiatement révoqués et supprimés.</li>
              <li>Votre nom et email seront remplacés par un pseudonyme anonyme non réversible.</li>
              <li>Vos publications et messages seront dissociés de toute référence nominative.</li>
            </ul>
          </div>

          <div id="gdpr-action-box" style="margin-top: 20px;">
            <button id="btn-gdpr-anonymize" onclick="triggerGdprAnonymization()" class="identity-btn" style="background: #dc2626;">
              Exercer mon Droit à l'Oubli (Anonymiser mon Compte)
            </button>
            <p id="gdpr-status-msg" style="margin-top: 12px; font-weight: bold; display: none;"></p>
          </div>
        </div>
      </div>

      <script>
        async function triggerGdprAnonymization() {
          if (!confirm("Êtes-vous certain de vouloir exercer votre droit à l'oubli ? Cette action est irréversible et anonymisera toutes vos données sur la plateforme.")) {
            return;
          }
          const btn = document.getElementById('btn-gdpr-anonymize');
          const msg = document.getElementById('gdpr-status-msg');
          btn.disabled = true;
          btn.innerText = "Traitement de l'anonymisation en cascade...";
          try {
            const res = await fetch('/api/user/gdpr-anonymize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success) {
              msg.style.display = 'block';
              msg.style.color = '#34d399';
              msg.innerText = "✓ Vos données personnelles ont été anonymisées avec succès sur l'ensemble des modules (Citadelle, Solara, Beam).";
              setTimeout(() => { window.location.href = '/'; }, 3000);
            } else {
              throw new Error(data.error || 'Échec du traitement');
            }
          } catch (err) {
            msg.style.display = 'block';
            msg.style.color = '#f87171';
            msg.innerText = "Erreur: " + err.message;
            btn.disabled = false;
            btn.innerText = "Réessayer l'anonymisation";
          }
        }
      </script>
    `;
  },
};

export const identityNavigationItems = [
  { id: "nav-login", label: "Login", route: "/login", pageView: IdentityLoginPageView },
  { id: "nav-register", label: "Register", route: "/register", pageView: IdentityRegisterPageView },
  { id: "nav-admin-users", label: "Admin Users", route: "/identity/admin/users", pageView: IdentityAdminUsersPageView },
  { id: "nav-privacy", label: "RGPD & Privacy", route: "/identity/privacy", pageView: IdentityGdprPrivacyPageView },
];

export const identityContributions: ContributionContract[] = [
  {
    id: "identity:login-nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/citadelle",
    kind: "navigation",
    title: "Login",
    route: "/login",
    icon: "🔑",
    placements: [{ id: "p-id-login-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 1 }],
  },
  {
    id: "identity:login-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/citadelle",
    kind: "page",
    title: "Identity — Login",
    route: "/login",
    placements: [{ id: "p-id-login-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: IdentityLoginPageView.render() },
  },
  {
    id: "identity:register-nav",
    contractVersion: "1.0.0",
    ownerApp: "@apps/citadelle",
    kind: "navigation",
    title: "Register",
    route: "/register",
    icon: "📝",
    placements: [{ id: "p-id-reg-nav", surfaceId: "application-shell", slotId: "shell.primary-sidebar", order: 2 }],
  },
  {
    id: "identity:register-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/citadelle",
    kind: "page",
    title: "Identity — Register Account",
    route: "/register",
    placements: [{ id: "p-id-reg-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: IdentityRegisterPageView.render() },
  },
  {
    id: "identity:admin-users-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/citadelle",
    kind: "page",
    title: "Identity — User Administration",
    route: "/identity/admin/users",
    placements: [{ id: "p-id-admin-users-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: IdentityAdminUsersPageView.render() },
  },
  {
    id: "identity:privacy-page",
    contractVersion: "1.0.0",
    ownerApp: "@apps/citadelle",
    kind: "page",
    title: "Identity — Confidentialité & Droit à l'Oubli",
    route: "/identity/privacy",
    placements: [{ id: "p-id-privacy-page", surfaceId: "application-shell", slotId: "main.content" }],
    content: { html: IdentityGdprPrivacyPageView.render() },
  },
];
