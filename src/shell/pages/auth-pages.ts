/**
 * @shell/pages — Public auth pages (login + public registration).
 *
 * `/login` is a functional form wired to `POST /api/auth/login` (uniform
 * errors, strict rate-limit bucket, `__Host-` cookie set server-side).
 * `/register` is a fully operational public signup form wired to
 * `POST /api/auth/register` (server-side validation, forced non-privileged
 * role, strict rate-limit bucket, 409 on duplicate email).
 *
 * Design : layout split (desktop), onglets unifiés avec pill coulissante,
 * labels flottants, validation inline, jauge force MDP, toggle visibilité.
 */

import type { ThemeMode } from "@mosaix/contracts";
import { renderHeadBlock } from "../ssr-engine.js";
import { renderThemeStyleTag } from "../theme/theme-bridge.js";
import { getShellClientScripts } from "../client/shell-client-scripts.js";

export interface AuthPageOptions {
  activeMode: ThemeMode;
  sharedStyles: string;
  /** Already server-validated via `resolveSafeNext()`. */
  safeNext: string;
  requestUrl?: string;
}

function authShell(
  title: string,
  activeMode: ThemeMode,
  sharedStyles: string,
  cardHtml: string,
): string {
  return `<!DOCTYPE html>
<html class="${activeMode === "dark" ? "dark" : activeMode === "high-contrast" ? "high-contrast" : ""}" lang="fr" data-theme-mode="${activeMode}">
<head>
<!-- Fragments de confiance internes : style compilé themes/*.json + CSS partagé renderer (jamais de données utilisateur brutes). -->
${renderHeadBlock(title, activeMode, renderThemeStyleTag(activeMode), sharedStyles)}
  ${getShellClientScripts()}
</head>
<body class="bg-background text-on-surface min-h-screen font-sans antialiased">
  <div class="min-h-screen flex">
    <!-- Colonne éditoriale (desktop uniquement) -->
    <div class="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between border-r border-outline-variant/20 bg-surface-container-low/50 p-12">
      <div class="flex items-center gap-2 text-on-surface-variant">
        <span class="w-2 h-2 rounded-full bg-primary"></span>
        <span class="text-xs font-mono uppercase tracking-wider">MosaiX Gateway</span>
      </div>
      <div class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary via-indigo-500 to-secondary flex items-center justify-center text-2xl shadow-lg shadow-primary/20">✨</div>
          <div>
            <h1 class="text-2xl font-bold text-on-surface leading-tight">L'écosystème<br/><span class="text-primary">modulaire</span></h1>
          </div>
        </div>
        <p class="text-sm text-on-surface-variant/80 leading-relaxed max-w-sm">
          Vos espaces, vos commandes et vos données au même endroit.
          Un compte unique, un accès unifié.
        </p>
        <div class="grid grid-cols-1 gap-3 pt-2">
          <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-container border border-outline-variant/20">
            <svg class="w-5 h-5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <div>
              <p class="text-xs font-semibold text-on-surface">Cookies sécurisés</p>
              <p class="text-[11px] text-on-surface-variant">Session protégée (\`__Host-\` cookie, HTTPS uniquement)</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-container border border-outline-variant/20">
            <svg class="w-5 h-5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <div>
              <p class="text-xs font-semibold text-on-surface">Redirections contrôlées</p>
              <p class="text-[11px] text-on-surface-variant">Retour uniquement vers des destinations internes validées</p>
            </div>
          </div>
        </div>
      </div>
      <div class="text-[11px] text-on-surface-variant/60">
        MosaiX Platform — accès membre
      </div>
    </div>
    <!-- Formulaire -->
    <div class="flex-1 flex items-center justify-center p-4 lg:p-8">
      <div class="w-full max-w-md space-y-6">
        <a href="/commerce" class="hidden lg:flex items-center justify-center gap-2 group">
          <span class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary via-indigo-500 to-secondary flex items-center justify-center text-xl">✨</span>
          <span class="font-bold text-on-surface group-hover:text-primary transition">MosaiX Platform</span>
        </a>
        ${cardHtml}
        <p class="text-center text-[11px] text-on-surface-variant/60 lg:hidden">
          <a href="/commerce" class="hover:text-on-surface transition">← Retour à la vitrine</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function renderLoginPage(opts: AuthPageOptions): string {
  const { activeMode, sharedStyles, safeNext } = opts;
  const card = `
      <div class="glass-card rounded-2xl p-6 space-y-5">
        <!-- Tabs unifiés Connexion / Inscription -->
        <div class="flex items-center justify-center mb-2">
          <div class="relative flex w-full max-w-[18rem] rounded-full bg-surface-container/60 p-1">
            <div class="auth-pill" style="left:4px"></div>
            <a href="/login?next=${encodeURIComponent(safeNext)}"
              class="flex-1 text-center text-sm font-semibold py-2.5 rounded-full text-on-surface relative z-10">Connexion</a>
            <a href="/register?next=${encodeURIComponent(safeNext)}"
              class="flex-1 text-center text-sm font-semibold py-2.5 rounded-full text-on-surface-variant relative z-10">Inscription</a>
          </div>
        </div>

        <div class="text-center">
          <h1 class="font-bold text-lg text-on-surface">Bon retour</h1>
          <p class="text-xs text-on-surface-variant mt-1">Accédez à votre fil, vos espaces et vos commandes.</p>
        </div>

        <form id="login-form" class="space-y-4" autocomplete="on" novalidate>
          <!-- Email -->
          <div class="auth-floating">
            <svg class="auth-field-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M22 7l-10 6L2 7"/></svg>
            <input id="login-email" name="email" type="email" required autocomplete="username"
              placeholder=" "
              class="auth-input"
              aria-describedby="login-email-hint" />
            <label for="login-email">Adresse email</label>
            <div id="login-email-hint" class="auth-validation-slot" aria-live="polite"></div>
          </div>

          <!-- Mot de passe -->
          <div class="auth-floating">
            <svg class="auth-field-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <input id="login-password" name="password" type="password" required autocomplete="current-password"
              placeholder=" "
              class="auth-input pr-10"
              aria-describedby="login-password-hint" />
            <label for="login-password">Mot de passe</label>
            <button type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition p-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
              aria-label="Afficher le mot de passe"
              aria-pressed="false"
              id="login-toggle-pwd">
              <svg class="w-4 h-4 icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="w-4 h-4 icon-eye-off hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24a9.12 9.12 0 014.2.4m0 0l2.3-2.3 2.3 2.3"/><path d="M1 1l22 22"/></svg>
            </button>
            <div id="login-password-hint" class="auth-validation-slot" aria-live="polite"></div>
          </div>

          <!-- Erreur globale -->
          <p id="login-error" class="hidden text-xs font-semibold text-error bg-error-container border border-error/20 rounded-xl px-3 py-2" role="alert"></p>

          <!-- Submit -->
          <button type="submit" id="login-submit" class="auth-submit">
            <span class="btn-text">Se connecter</span>
            <svg class="btn-spinner w-4 h-4 hidden" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="31.4 31.4"/><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></svg>
          </button>
        </form>

        <p class="text-xs text-on-surface-variant text-center">
          Pas encore de compte ?
          <a href="/register?next=${encodeURIComponent(safeNext)}" class="text-primary font-semibold hover:underline">Créer un compte</a>
        </p>
      </div>

      <script>
        (function() {
          var next = ${JSON.stringify(safeNext)};
          var form = document.getElementById('login-form');
          var err = document.getElementById('login-error');
          var btn = document.getElementById('login-submit');
          var btnText = btn.querySelector('.btn-text');
          var btnSpinner = btn.querySelector('.btn-spinner');
          var emailInput = document.getElementById('login-email');
          var passInput = document.getElementById('login-password');
          var toggleBtn = document.getElementById('login-toggle-pwd');
          var submitting = false;

          // Toggle password visibility (accessible)
          if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
              var isPassword = passInput.type === 'password';
              passInput.type = isPassword ? 'text' : 'password';
              toggleBtn.setAttribute('aria-pressed', String(isPassword));
              toggleBtn.querySelector('.icon-eye').classList.toggle('hidden', isPassword);
              toggleBtn.querySelector('.icon-eye-off').classList.toggle('hidden', !isPassword);
              passInput.focus();
            });
          }

          // Validation inline email
          emailInput.addEventListener('blur', function() {
            var v = this.value.trim();
            var hint = document.getElementById('login-email-hint');
            if (!v) {
              hint.textContent = '';
              this.classList.remove('has-error', 'is-valid');
            } else if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v)) {
              hint.textContent = 'Format d\\'email invalide';
              this.classList.add('has-error');
              this.classList.remove('is-valid');
            } else {
              hint.textContent = '';
              this.classList.remove('has-error');
              this.classList.add('is-valid');
            }
          });

          emailInput.addEventListener('input', function() {
            this.classList.remove('has-error');
            var hint = document.getElementById('login-email-hint');
            if (hint) hint.textContent = '';
          });

          form.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (submitting) return;
            submitting = true;

            err.classList.add('hidden');
            btn.disabled = true;
            btnText.textContent = 'Connexion en cours…';
            btnSpinner.classList.remove('hidden');

            try {
              var res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: emailInput.value,
                  password: passInput.value
                })
              });
              if (res.ok) {
                btnText.textContent = 'Succès — redirection…';
                window.location.href = next;
              } else {
                var data = await res.json().catch(function() { return {}; });
                err.textContent = data.error || 'Identifiants invalides. Vérifiez votre email et mot de passe.';
                err.classList.remove('hidden');
                passInput.classList.add('has-error');
                passInput.focus();
              }
            } catch (ex) {
              err.textContent = 'Service momentanément indisponible. Réessayez dans un instant.';
              err.classList.remove('hidden');
            } finally {
              if (!err.classList.contains('hidden')) {
                btn.disabled = false;
                btnText.textContent = 'Se connecter';
                btnSpinner.classList.add('hidden');
                submitting = false;
              }
            }
          });
        })();
      </script>`;
  return authShell("Connexion", activeMode, sharedStyles, card);
}

export function renderRegisterPage(opts: AuthPageOptions): string {
  const { activeMode, sharedStyles, safeNext } = opts;
  const card = `
      <div class="glass-card rounded-2xl p-6 space-y-5">
        <!-- Tabs unifiés Connexion / Inscription -->
        <div class="flex items-center justify-center mb-2">
          <div class="relative flex w-full max-w-[18rem] rounded-full bg-surface-container/60 p-1">
            <div class="auth-pill" style="left:calc(50% + 4px)"></div>
            <a href="/login?next=${encodeURIComponent(safeNext)}"
              class="flex-1 text-center text-sm font-semibold py-2.5 rounded-full text-on-surface-variant relative z-10">Connexion</a>
            <a href="/register?next=${encodeURIComponent(safeNext)}"
              class="flex-1 text-center text-sm font-semibold py-2.5 rounded-full text-on-surface relative z-10">Inscription</a>
          </div>
        </div>

        <div class="text-center">
          <h1 class="font-bold text-lg text-on-surface">Créer un compte</h1>
          <p class="text-xs text-on-surface-variant mt-1">Rejoignez la plateforme MosaiX et accédez à vos espaces.</p>
        </div>

        <form id="register-form" class="space-y-4" autocomplete="on" novalidate>
          <!-- Email -->
          <div class="auth-floating">
            <svg class="auth-field-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M22 7l-10 6L2 7"/></svg>
            <input id="register-email" name="email" type="email" required autocomplete="username"
              placeholder=" "
              class="auth-input"
              aria-describedby="register-email-hint" />
            <label for="register-email">Adresse email</label>
            <div id="register-email-hint" class="auth-validation-slot" aria-live="polite"></div>
          </div>

          <!-- Nom d'affichage -->
          <div class="auth-floating">
            <svg class="auth-field-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input id="register-display-name" name="displayName" type="text" required autocomplete="name"
              placeholder=" "
              class="auth-input"
              aria-describedby="register-name-hint" />
            <label for="register-display-name">Nom d'affichage</label>
            <div id="register-name-hint" class="auth-validation-slot" aria-live="polite"></div>
          </div>

          <!-- Mot de passe -->
          <div class="auth-floating">
            <svg class="auth-field-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <input id="register-password" name="password" type="password" required autocomplete="new-password"
              placeholder=" "
              class="auth-input pr-10"
              aria-describedby="register-password-hint" />
            <label for="register-password">Mot de passe</label>
            <button type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition p-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
              aria-label="Afficher le mot de passe"
              aria-pressed="false"
              id="register-toggle-pwd">
              <svg class="w-4 h-4 icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="w-4 h-4 icon-eye-off hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24a9.12 9.12 0 014.2.4m0 0l2.3-2.3 2.3 2.3"/><path d="M1 1l22 22"/></svg>
            </button>
            <div id="register-password-hint" class="auth-validation-slot" aria-live="polite"></div>

            <!-- Jauge de force + checklist (recommandations, non obligatoires) -->
            <div id="register-strength" class="mt-3 space-y-2 hidden">
              <div class="flex items-center justify-between">
                <div class="auth-strength-meter" id="strength-meter">
                  <div class="str-seg" id="str-1"></div>
                  <div class="str-seg" id="str-2"></div>
                  <div class="str-seg" id="str-3"></div>
                  <div class="str-seg" id="str-4"></div>
                </div>
                <span id="strength-label" class="text-[10px] font-medium text-on-surface-variant"></span>
              </div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div class="auth-check-item" id="check-len">
                  <span class="check-dot"></span>8 caractères minimum
                </div>
                <div class="auth-check-item" id="check-upper">
                  <span class="check-dot"></span>Majuscule (recommandé)
                </div>
                <div class="auth-check-item" id="check-digit">
                  <span class="check-dot"></span>Chiffre (recommandé)
                </div>
                <div class="auth-check-item" id="check-sym">
                  <span class="check-dot"></span>Symbole (recommandé)
                </div>
              </div>
            </div>
          </div>

          <!-- Erreur / Succès globaux -->
          <p id="register-error" class="hidden text-xs font-semibold text-error bg-error-container border border-error/20 rounded-xl px-3 py-2" role="alert"></p>
          <p id="register-success" class="hidden text-xs font-semibold text-success bg-success-container border border-success/20 rounded-xl px-3 py-2" role="status"></p>

          <!-- Submit -->
          <button type="submit" id="register-submit" class="auth-submit">
            <span class="btn-text">Créer mon compte</span>
            <svg class="btn-spinner w-4 h-4 hidden" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="31.4 31.4"/><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></svg>
          </button>
        </form>

        <p class="text-xs text-on-surface-variant text-center">
          Vous avez déjà un compte ?
          <a href="/login?next=${encodeURIComponent(safeNext)}" class="text-primary font-semibold hover:underline">Se connecter</a>
        </p>
      </div>

      <script>
        (function() {
          var next = ${JSON.stringify(safeNext)};
          var form = document.getElementById('register-form');
          var err = document.getElementById('register-error');
          var success = document.getElementById('register-success');
          var btn = document.getElementById('register-submit');
          var btnText = btn.querySelector('.btn-text');
          var btnSpinner = btn.querySelector('.btn-spinner');
          var emailInput = document.getElementById('register-email');
          var nameInput = document.getElementById('register-display-name');
          var passInput = document.getElementById('register-password');
          var toggleBtn = document.getElementById('register-toggle-pwd');
          var strengthDiv = document.getElementById('register-strength');
          var submitting = false;
          var redirected = false;

          // Toggle password visibility (accessible)
          if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
              var isPassword = passInput.type === 'password';
              passInput.type = isPassword ? 'text' : 'password';
              toggleBtn.setAttribute('aria-pressed', String(isPassword));
              toggleBtn.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
              toggleBtn.querySelector('.icon-eye').classList.toggle('hidden', isPassword);
              toggleBtn.querySelector('.icon-eye-off').classList.toggle('hidden', !isPassword);
              passInput.focus();
            });
          }

          // Validation inline email
          emailInput.addEventListener('blur', function() {
            var v = this.value.trim();
            var hint = document.getElementById('register-email-hint');
            if (!v) {
              hint.textContent = '';
              this.classList.remove('has-error', 'is-valid');
            } else if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v)) {
              hint.textContent = 'Format d\\'email invalide';
              this.classList.add('has-error');
              this.classList.remove('is-valid');
            } else {
              hint.textContent = '';
              this.classList.remove('has-error');
              this.classList.add('is-valid');
            }
          });
          emailInput.addEventListener('input', function() {
            this.classList.remove('has-error', 'is-valid');
            var hint = document.getElementById('register-email-hint');
            if (hint) hint.textContent = '';
          });

          // Validation inline nom
          nameInput.addEventListener('blur', function() {
            var v = this.value.trim();
            var hint = document.getElementById('register-name-hint');
            if (v && v.length < 2) {
              hint.textContent = 'Minimum 2 caractères';
              this.classList.add('has-error');
            } else {
              hint.textContent = '';
              this.classList.remove('has-error');
              if (v && v.length >= 2) this.classList.add('is-valid');
            }
          });
          nameInput.addEventListener('input', function() {
            this.classList.remove('has-error', 'is-valid');
            var hint = document.getElementById('register-name-hint');
            if (hint) hint.textContent = '';
          });

          // Force mot de passe
          var checks = {
            len: document.getElementById('check-len'),
            upper: document.getElementById('check-upper'),
            digit: document.getElementById('check-digit'),
            sym: document.getElementById('check-sym')
          };
          var segs = [
            document.getElementById('str-1'),
            document.getElementById('str-2'),
            document.getElementById('str-3'),
            document.getElementById('str-4')
          ];
          var label = document.getElementById('strength-label');

          passInput.addEventListener('focus', function() {
            strengthDiv.classList.remove('hidden');
          });

          passInput.addEventListener('input', function() {
            this.classList.remove('has-error');
            var v = this.value;
            var score = 0;
            var cLen = v.length >= 8;
            var cUpper = /[A-Z]/.test(v);
            var cDigit = /[0-9]/.test(v);
            var cSym = /[^A-Za-z0-9]/.test(v);

            if (cLen) { checks.len.classList.add('satisfied'); score++; } else checks.len.classList.remove('satisfied');
            if (cUpper) { checks.upper.classList.add('satisfied'); score++; } else checks.upper.classList.remove('satisfied');
            if (cDigit) { checks.digit.classList.add('satisfied'); score++; } else checks.digit.classList.remove('satisfied');
            if (cSym) { checks.sym.classList.add('satisfied'); score++; } else checks.sym.classList.remove('satisfied');

            var colors = ['var(--color-error)', 'var(--color-error)', 'var(--color-warning, var(--color-error))', 'var(--color-success)', 'var(--color-success)'];
            var texts = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];
            for (var i = 0; i < 4; i++) {
              segs[i].style.backgroundColor = i < score ? colors[score] : '';
            }
            label.textContent = v ? texts[score] || '' : '';
          });

          function clearAllValidation() {
            [emailInput, nameInput, passInput].forEach(function(input) {
              input.classList.remove('has-error', 'is-valid');
            });
            var hints = document.querySelectorAll('[id$="-hint"]');
            hints.forEach(function(h) { h.textContent = ''; });
            for (var k in checks) checks[k].classList.remove('satisfied');
            label.textContent = '';
            segs.forEach(function(s) { s.style.backgroundColor = ''; });
            strengthDiv.classList.add('hidden');
          }

          form.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (submitting || redirected) return;
            submitting = true;

            err.classList.add('hidden');
            success.classList.add('hidden');
            btn.disabled = true;
            btnText.textContent = 'Création en cours…';
            btnSpinner.classList.remove('hidden');

            try {
              var res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: emailInput.value,
                  password: passInput.value,
                  displayName: nameInput.value
                })
              });
              if (res.ok) {
                redirected = true;
                success.textContent = 'Compte créé avec succès. Vous pouvez maintenant vous connecter.';
                success.classList.remove('hidden');
                btnText.textContent = 'Succès…';
                clearAllValidation();
                form.reset();
                setTimeout(function() {
                  window.location.href = '/login?next=' + encodeURIComponent(next);
                }, 1500);
              } else {
                var data = await res.json().catch(function() { return {}; });
                err.textContent = data.error || 'Erreur lors de la création du compte. Réessayez.';
                err.classList.remove('hidden');
              }
            } catch (ex) {
              err.textContent = 'Service momentanément indisponible. Réessayez dans un instant.';
              err.classList.remove('hidden');
            } finally {
              if (!redirected) {
                btn.disabled = false;
                btnText.textContent = 'Créer mon compte';
                btnSpinner.classList.add('hidden');
                submitting = false;
              }
            }
          });
        })();
      </script>`;
  return authShell("Inscription", activeMode, sharedStyles, card);
}
