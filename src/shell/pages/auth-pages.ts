/**
 * @shell/pages — Public auth pages (login + public registration).
 *
 * `/login` is a functional form wired to `POST /api/auth/login` (uniform
 * errors, strict rate-limit bucket, `__Host-` cookie set server-side).
 * `/register` is a fully operational public signup form wired to
 * `POST /api/auth/register` (server-side validation, forced non-privileged
 * role, strict rate-limit bucket, 409 on duplicate email).
 *
 * Design : layout split (desktop), panel switcher animé côté client,
 * floating labels avec icônes réactives, state machine de validation,
 * jauge force MDP + checklist, toggle visibilité, glow submit.
 * Tokens : 100 % variables CSS du design system MosaiX (theme-aware).
 *
 * Fixes appliqués :
 *   - DOM order : input avant label/icônes (requis par le sélecteur CSS `~`)
 *   - Label left : offset 2.75rem pour passer l'icône gauche
 *   - Regex email : \\s dans TS → \s dans le JS inline (1 niveau d'échappement)
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

// ─── Colonne éditoriale partagée ─────────────────────────────────────────────
function editorialColumn(): string {
  return `
    <div class="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between border-r border-outline-variant/20 bg-surface-container-low/50 p-12 auth-bg-grid relative">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-on-surface-variant">
          <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span class="text-[11px] font-mono uppercase tracking-wider">MosaiX Gateway</span>
        </div>
        <span class="text-[11px] font-mono text-success flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-success"></span>
          En ligne
        </span>
      </div>

      <div class="space-y-8 my-auto py-10">
        <div class="relative w-fit p-5 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-2xl backdrop-blur-md auth-crosshair">
          <div class="grid grid-cols-2 gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-600 shadow-md shadow-primary/30"></div>
            <div class="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/40"></div>
            <div class="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/40"></div>
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary to-primary opacity-80"></div>
          </div>
        </div>

        <div class="space-y-3">
          <h1 class="text-3xl xl:text-4xl font-bold text-on-surface tracking-tight leading-tight">
            L'écosystème<br/>
            <span class="text-primary">modulaire.</span>
          </h1>
          <p class="text-sm text-on-surface-variant leading-relaxed max-w-sm">
            Espaces connectés, composables et orchestrés.<br/>Un compte unique, un accès unifié.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 max-w-sm">
          <div class="p-3 rounded-xl bg-surface-container border border-outline-variant/20">
            <div class="flex items-center gap-2 text-xs font-mono text-primary mb-1">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <span>Zero-Trust</span>
            </div>
            <p class="text-[11px] text-on-surface-variant leading-snug">Sécurité renforcée pour votre environnement.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface-container border border-outline-variant/20">
            <div class="flex items-center gap-2 text-xs font-mono text-success mb-1">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span>Instantané</span>
            </div>
            <p class="text-[11px] text-on-surface-variant leading-snug">Espaces connectés et configurables.</p>
          </div>
        </div>
      </div>

      <div class="text-[11px] font-mono text-on-surface-variant/50 flex items-center justify-between">
        <span>MosaiX Platform — accès membre</span>
        <span class="opacity-60">2026</span>
      </div>
    </div>`;
}

// ─── Tab switcher (pill coulissante — navigation href réelle) ─────────────────
function tabSwitcher(active: "login" | "register", safeNext: string): string {
  const loginActive = active === "login";
  return `
    <div class="relative p-1 bg-surface-container-high rounded-xl border border-outline-variant/30 flex items-center" role="tablist" aria-label="Mode d'accès">
      <div class="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-surface border border-outline-variant/40 shadow-sm transition-all duration-300 ease-out"
           style="left:${loginActive ? "4px" : "calc(50% + 0px)"}"></div>
      <a href="/login?next=${encodeURIComponent(safeNext)}"
         role="tab" aria-selected="${loginActive}"
         class="relative z-10 flex-1 py-2.5 px-3 rounded-lg text-xs font-mono font-semibold transition-colors duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${loginActive ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"}">
        <span class="w-1.5 h-1.5 rounded-full transition-colors ${loginActive ? "bg-primary" : "bg-outline-variant"}"></span>
        Connexion
      </a>
      <a href="/register?next=${encodeURIComponent(safeNext)}"
         role="tab" aria-selected="${!loginActive}"
         class="relative z-10 flex-1 py-2.5 px-3 rounded-lg text-xs font-mono font-semibold transition-colors duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${!loginActive ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"}">
        <span class="w-1.5 h-1.5 rounded-full transition-colors ${!loginActive ? "bg-primary" : "bg-outline-variant"}"></span>
        Créer un compte
      </a>
    </div>`;
}

/**
 * Floating field avec icône gauche.
 *
 * Ordre DOM correct pour que les sélecteurs CSS `input ~ label` et
 * `input ~ .auth-field-icon` fonctionnent (le sélecteur ~ ne peut
 * cibler que les éléments qui SUIVENT l'input dans le DOM) :
 *   1. <input>          ← toujours en premier
 *   2. <label>          ← suit l'input
 *   3. .auth-field-icon ← suit le label
 *   4. .valid-icon      ← suit l'icône de champ
 *
 * Le label utilise `auth-label-with-icon` (left: 2.75rem) pour
 * s'aligner après l'icône gauche (pl-11 = 2.75rem sur l'input).
 */
function floatingField({
  id,
  name,
  type,
  autocomplete,
  placeholder = " ",
  inputmode,
  required = true,
  extraInputClass = "",
  label,
  iconPath,
  validIconId,
  hintId,
  ariaDescribedBy,
  afterInput = "",
}: {
  id: string;
  name: string;
  type: string;
  autocomplete: string;
  placeholder?: string;
  inputmode?: string;
  required?: boolean;
  extraInputClass?: string;
  label: string;
  iconPath: string;
  validIconId?: string;
  hintId?: string;
  ariaDescribedBy?: string;
  /** HTML inséré après l'icône de champ (ex: bouton toggle MDP) */
  afterInput?: string;
}): string {
  const inputmodeAttr = inputmode ? ` inputmode="${inputmode}"` : "";
  const describedBy = ariaDescribedBy ? ` aria-describedby="${ariaDescribedBy}"` : (hintId ? ` aria-describedby="${hintId}"` : "");
  const validIconHtml = validIconId
    ? `<div aria-hidden="true" class="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none hidden text-success" id="${validIconId}">
         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
       </div>`
    : "";

  return `<div class="auth-floating relative">
    <input id="${id}" name="${name}" type="${type}"${required ? ' required' : ''} autocomplete="${autocomplete}"
      placeholder="${placeholder}"${inputmodeAttr}
      class="auth-input block w-full pl-11 ${extraInputClass} pt-5 pb-2"${describedBy}${required ? ' aria-required="true"' : ''}/>
    <label for="${id}" class="auth-label-with-icon">${label}</label>
    <div class="auth-field-icon absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant transition-colors">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconPath}</svg>
    </div>
    ${validIconHtml}
    ${afterInput}
  </div>`;
}

// ─── Shell wrapper ────────────────────────────────────────────────────────────
function authShell(
  title: string,
  activeMode: ThemeMode,
  sharedStyles: string,
  formHtml: string,
): string {
  // Extra styles injectés dans le <head> : corrections spécifiques pages auth
  const authExtraStyles = `<style>
    /* Label avec icône gauche : left offset = pl-11 (2.75rem) */
    .auth-label-with-icon {
      position: absolute;
      left: 2.75rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      font-size: 0.8125rem;
      color: var(--color-on-surface-variant);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: left center;
      user-select: none;
      white-space: nowrap;
    }
    .auth-floating input:focus ~ .auth-label-with-icon,
    .auth-floating input:not(:placeholder-shown) ~ .auth-label-with-icon {
      top: 0.5rem;
      transform: translateY(0) scale(0.72);
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--color-primary);
    }
    .auth-floating input.has-error ~ .auth-label-with-icon {
      color: var(--color-error);
    }
    /* L'icône suit le label dans le DOM → on cible via :has ou on garde JS.
       Pour la couleur réactive on utilise une classe JS (.field-focused).   */
    .auth-floating.field-focused .auth-field-icon { color: var(--color-primary); }
    .auth-floating input.has-error ~ label.auth-label-with-icon ~ .auth-field-icon { color: var(--color-error); }
    .auth-floating input.is-valid ~ label.auth-label-with-icon ~ .auth-field-icon { color: var(--color-success); }
    /* Supprime overflow:hidden sur auth-frame pour que auth-crosshair soit visible */
    .auth-frame { overflow: visible; }
  </style>`;

  return `<!DOCTYPE html>
<html class="${activeMode === "dark" ? "dark" : activeMode === "high-contrast" ? "high-contrast" : ""}" lang="fr" data-theme-mode="${activeMode}">
<head>
<!-- Fragments de confiance internes : style compilé themes/*.json + CSS partagé renderer (jamais de données utilisateur brutes). -->
${renderHeadBlock(title, activeMode, renderThemeStyleTag(activeMode), sharedStyles)}
  ${getShellClientScripts()}
  ${authExtraStyles}
</head>
<body class="bg-background text-on-surface min-h-screen font-sans antialiased">
  <div class="min-h-screen flex">
    ${editorialColumn()}
    <!-- Zone formulaire -->
    <div class="flex-1 flex items-center justify-center p-4 lg:p-8 auth-bg-grid">
      <div class="w-full max-w-md space-y-5">
        <!-- Logo mobile -->
        <a href="/commerce" class="flex lg:hidden items-center justify-center gap-2 group mb-2">
          <span class="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary via-indigo-500 to-secondary flex items-center justify-center text-lg">✨</span>
          <span class="font-bold text-on-surface group-hover:text-primary transition text-sm">MosaiX Platform</span>
        </a>

        <div class="glass-card auth-frame auth-crosshair p-6 sm:p-8 space-y-6">
          ${formHtml}
        </div>

        <p class="text-center text-[11px] text-on-surface-variant/60 lg:hidden">
          <a href="/commerce" class="hover:text-on-surface transition">← Retour à la vitrine</a>
        </p>
      </div>
    </div>
  </div>
  <script>
    /* Reactive icon color via JS focus/blur (CSS ~ sélecteur ne peut pas
       remonter vers un sibling précédent sans :has(), non supporté partout). */
    document.querySelectorAll('.auth-floating input').forEach(function(input) {
      var wrap = input.closest('.auth-floating');
      if (!wrap) return;
      input.addEventListener('focus', function() { wrap.classList.add('field-focused'); });
      input.addEventListener('blur',  function() { wrap.classList.remove('field-focused'); });
    });
  </script>
</body>
</html>`;
}

// ─── Page Login ───────────────────────────────────────────────────────────────
export function renderLoginPage(opts: AuthPageOptions): string {
  const { activeMode, sharedStyles, safeNext } = opts;

  const togglePwdBtn = `
    <button type="button"
      class="absolute inset-y-0 right-0 pr-3 pl-2 flex items-center gap-1.5 text-xs font-mono text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-r-xl"
      aria-label="Afficher le mot de passe" aria-pressed="false" id="login-toggle-pwd">
      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" id="login-icon-show"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      <svg class="w-4 h-4 shrink-0 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" id="login-icon-hide"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
      <span class="text-[11px] select-none" id="login-toggle-text">Afficher</span>
    </button>`;

  const formHtml = `
    ${tabSwitcher("login", safeNext)}

    <!-- En-tête -->
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-on-surface tracking-tight">Bon retour</h2>
        <span class="text-[10px] font-mono text-success flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-success"></span>Chiffrement TLS
        </span>
      </div>
      <p class="text-xs text-on-surface-variant">Accédez à votre fil, vos espaces et vos commandes.</p>
    </div>

    <!-- Bannière erreur / succès -->
    <div id="login-banner" role="alert" aria-live="assertive" aria-atomic="true"
         class="hidden p-3.5 rounded-xl font-mono text-xs border transition-all"></div>

    <form id="login-form" class="space-y-4" autocomplete="on" novalidate>

      <!-- Email -->
      <div class="space-y-1">
        ${floatingField({
          id: "login-email",
          name: "email",
          type: "email",
          autocomplete: "username",
          label: "Adresse e-mail",
          iconPath: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206"/>`,
          validIconId: "login-email-valid-icon",
          hintId: "login-email-hint",
          extraInputClass: "pr-10",
        })}
        <div id="login-email-hint" class="auth-validation-slot text-[11px] font-mono px-1 flex items-center gap-1.5" aria-live="polite"></div>
      </div>

      <!-- Mot de passe -->
      <div class="space-y-1">
        <div class="flex justify-end">
          <span class="text-[11px] font-mono text-on-surface-variant/60">Mot de passe oublié ?</span>
        </div>
        ${floatingField({
          id: "login-password",
          name: "password",
          type: "password",
          autocomplete: "current-password",
          label: "Mot de passe",
          iconPath: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>`,
          hintId: "login-password-hint",
          extraInputClass: "pr-20 font-mono",
          afterInput: togglePwdBtn,
        })}
        <div id="login-password-hint" class="auth-validation-slot text-[11px] font-mono px-1" aria-live="polite"></div>
      </div>

      <!-- Mémoriser (session persistante gérée côté serveur) -->
      <label class="flex items-center cursor-pointer select-none gap-2 text-on-surface-variant">
        <input type="checkbox" name="remember" class="w-4 h-4 rounded border-outline-variant bg-surface text-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-primary transition" />
        <span class="text-[11px] font-mono">Rester connecté sur cette station</span>
      </label>

      <!-- Submit -->
      <div class="pt-1">
        <button type="submit" id="login-submit" class="auth-submit w-full flex items-center justify-center gap-3">
          <span id="login-btn-text">Se connecter</span>
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" id="login-btn-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          <div class="hidden w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" id="login-btn-spinner"></div>
        </button>
      </div>
    </form>

    <div class="border-t border-outline-variant/30 pt-4 text-center">
      <p class="text-xs text-on-surface-variant">
        Nouveau sur l'écosystème ?
        <a href="/register?next=${encodeURIComponent(safeNext)}" class="font-mono text-primary hover:underline underline-offset-4 ml-1 transition-colors">Créer un compte</a>
      </p>
    </div>

    <script>
      (function() {
        var next = ${JSON.stringify(safeNext)};
        var form = document.getElementById('login-form');
        var banner = document.getElementById('login-banner');
        var submitBtn = document.getElementById('login-submit');
        var btnText = document.getElementById('login-btn-text');
        var btnIcon = document.getElementById('login-btn-icon');
        var btnSpinner = document.getElementById('login-btn-spinner');
        var emailInput = document.getElementById('login-email');
        var passInput = document.getElementById('login-password');
        var toggleBtn = document.getElementById('login-toggle-pwd');
        var showIcon = document.getElementById('login-icon-show');
        var hideIcon = document.getElementById('login-icon-hide');
        var toggleText = document.getElementById('login-toggle-text');
        var emailValidIcon = document.getElementById('login-email-valid-icon');
        var submitting = false;

        // ── Toggle visibilité MDP
        toggleBtn && toggleBtn.addEventListener('click', function() {
          var isHidden = passInput.type === 'password';
          passInput.type = isHidden ? 'text' : 'password';
          toggleBtn.setAttribute('aria-pressed', String(isHidden));
          toggleBtn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
          showIcon.classList.toggle('hidden', isHidden);
          hideIcon.classList.toggle('hidden', !isHidden);
          toggleText.textContent = isHidden ? 'Masquer' : 'Afficher';
          passInput.focus();
        });

        // ── Validation email (regex correctement échappée pour le JS inline)
        function validateEmail(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
        }

        function setEmailState(valid) {
          var hint = document.getElementById('login-email-hint');
          if (valid) {
            emailInput.classList.remove('has-error');
            emailInput.classList.add('is-valid');
            if (emailValidIcon) emailValidIcon.classList.remove('hidden');
            if (hint) hint.innerHTML = '<span style="color:var(--color-success)" class="flex items-center gap-1">Adresse e-mail valide \u2713</span>';
          } else {
            emailInput.classList.add('has-error');
            emailInput.classList.remove('is-valid');
            if (emailValidIcon) emailValidIcon.classList.add('hidden');
            if (hint) hint.innerHTML = '<span style="color:var(--color-error)" class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5 inline-block shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Format attendu\u00a0: exemple@domaine.com</span>';
          }
        }

        emailInput.addEventListener('blur', function() {
          if (this.value.trim()) setEmailState(validateEmail(this.value));
          else {
            this.classList.remove('has-error', 'is-valid');
            if (emailValidIcon) emailValidIcon.classList.add('hidden');
            document.getElementById('login-email-hint').innerHTML = '';
          }
        });
        emailInput.addEventListener('input', function() {
          this.classList.remove('has-error', 'is-valid');
          if (emailValidIcon) emailValidIcon.classList.add('hidden');
          document.getElementById('login-email-hint').innerHTML = '';
          if (banner) banner.classList.add('hidden');
        });
        passInput.addEventListener('input', function() {
          this.classList.remove('has-error');
          if (banner) banner.classList.add('hidden');
        });

        function showBanner(msg, type) {
          if (!banner) return;
          banner.innerHTML = msg;
          banner.className = 'p-3.5 rounded-xl font-mono text-xs border transition-all ' + (
            type === 'error'
              ? 'bg-error-container border-error/30 text-error'
              : 'bg-success-container border-success/30 text-success'
          );
          banner.classList.remove('hidden');
        }

        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          if (submitting) return;
          if (!validateEmail(emailInput.value)) { setEmailState(false); emailInput.focus(); return; }
          if (!passInput.value) { passInput.classList.add('has-error'); passInput.focus(); return; }

          submitting = true;
          if (banner) banner.classList.add('hidden');
          submitBtn.disabled = true;
          btnText.textContent = 'V\u00e9rification\u2026';
          btnIcon.classList.add('hidden');
          btnSpinner.classList.remove('hidden');

          try {
            var res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailInput.value, password: passInput.value })
            });
            if (res.ok) {
              btnText.textContent = 'Session autoris\u00e9e \u2713';
              submitBtn.style.backgroundColor = 'var(--color-success)';
              showBanner('Acc\u00e8s accord\u00e9. Initialisation des espaces en cours\u2026', 'success');
              btnSpinner.classList.add('hidden');
              btnIcon.classList.remove('hidden');
              setTimeout(function() { window.location.href = next; }, 800);
              return;
            } else {
              var data = await res.json().catch(function() { return {}; });
              showBanner(data.error || 'Identifiants invalides. V\u00e9rifiez votre email et mot de passe.', 'error');
              passInput.classList.add('has-error');
              passInput.focus();
            }
          } catch (ex) {
            showBanner('Service momentan\u00e9ment indisponible. R\u00e9essayez dans un instant.', 'error');
          } finally {
            if (!submitBtn.style.backgroundColor) {
              submitBtn.disabled = false;
              btnText.textContent = 'Se connecter';
              btnIcon.classList.remove('hidden');
              btnSpinner.classList.add('hidden');
            }
            submitting = false;
          }
        });
      })();
    </script>`;

  return authShell("Connexion", activeMode, sharedStyles, formHtml);
}

// ─── Page Register ────────────────────────────────────────────────────────────
export function renderRegisterPage(opts: AuthPageOptions): string {
  const { activeMode, sharedStyles, safeNext } = opts;

  const togglePwdBtn = `
    <button type="button"
      class="absolute inset-y-0 right-0 pr-3 pl-2 flex items-center gap-1.5 text-xs font-mono text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-r-xl"
      aria-label="Afficher le mot de passe" aria-pressed="false" id="reg-toggle-pwd">
      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" id="reg-icon-show"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      <svg class="w-4 h-4 shrink-0 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" id="reg-icon-hide"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
      <span class="text-[11px] select-none" id="reg-toggle-text">Afficher</span>
    </button>`;

  const formHtml = `
    ${tabSwitcher("register", safeNext)}

    <!-- En-tête -->
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-on-surface tracking-tight">Cr\u00e9er votre compte</h2>
        <span class="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-surface-container text-primary border border-outline-variant/30">Gratuit</span>
      </div>
      <p class="text-xs text-on-surface-variant">Rejoignez le r\u00e9seau modulaire MosaiX. Aucune carte bancaire requise.</p>
    </div>

    <!-- Bannière -->
    <div id="register-banner" role="alert" aria-live="assertive" aria-atomic="true" tabindex="-1"
         class="hidden p-3.5 rounded-xl font-mono text-xs border transition-all"></div>

    <form id="register-form" class="space-y-4" autocomplete="on" novalidate>

      <!-- Nom -->
      <div class="space-y-1">
        ${floatingField({
          id: "register-display-name",
          name: "displayName",
          type: "text",
          autocomplete: "name",
          label: `Nom d\u2019affichage <span aria-hidden="true" class="text-primary">*</span>`,
          iconPath: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>`,
          validIconId: "reg-name-valid-icon",
          hintId: "register-name-hint",
          extraInputClass: "pr-10",
        })}
        <div id="register-name-hint" class="auth-validation-slot text-[11px] font-mono px-1 flex items-center gap-1.5" aria-live="polite"></div>
      </div>

      <!-- Email -->
      <div class="space-y-1">
        ${floatingField({
          id: "register-email",
          name: "email",
          type: "email",
          autocomplete: "username email",
          inputmode: "email",
          label: `Adresse e-mail <span aria-hidden="true" class="text-primary">*</span>`,
          iconPath: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206"/>`,
          validIconId: "reg-email-valid-icon",
          hintId: "register-email-hint",
          extraInputClass: "pr-10",
        })}
        <div id="register-email-hint" class="auth-validation-slot text-[11px] font-mono px-1 flex items-center justify-between" aria-live="polite">
          <span class="text-on-surface-variant/60 text-[10.5px]">Une fois le compte cr\u00e9\u00e9, vous pourrez vous connecter imm\u00e9diatement.</span>
        </div>
      </div>

      <!-- Mot de passe -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-[11px] font-mono px-0.5">
          <span class="text-on-surface-variant flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-primary inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            Pas de ressaisie : v\u00e9rifiez en 1 clic
          </span>
          <button type="button" id="reg-gen-pwd"
            class="text-primary hover:text-on-surface underline underline-offset-2 flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            G\u00e9n\u00e9rer un MDP fort
          </button>
        </div>
        ${floatingField({
          id: "register-password",
          name: "password",
          type: "password",
          autocomplete: "new-password",
          label: `Mot de passe s\u00e9curis\u00e9 <span aria-hidden="true" class="text-primary">*</span>`,
          iconPath: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>`,
          hintId: "register-password-hint",
          ariaDescribedBy: "reg-pwd-checklist reg-strength-label register-password-hint",
          extraInputClass: "pr-24 font-mono",
          afterInput: togglePwdBtn,
        })}

        <!-- Jauge de force -->
        <div class="space-y-1.5 px-0.5">
          <div class="flex items-center justify-between">
            <div aria-hidden="true" class="auth-strength-meter" id="reg-strength-meter">
              <div class="str-seg" id="reg-str-1"></div>
              <div class="str-seg" id="reg-str-2"></div>
              <div class="str-seg" id="reg-str-3"></div>
              <div class="str-seg" id="reg-str-4"></div>
            </div>
            <span class="text-[11px] font-mono text-on-surface-variant" id="reg-strength-label">Force : Saisissez un mot de passe</span>
          </div>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1 pt-0.5" id="reg-pwd-checklist">
            <div class="auth-check-item" id="chk-len"><span class="check-dot" id="dot-len"></span><span>8+ caract\u00e8res</span></div>
            <div class="auth-check-item" id="chk-upper"><span class="check-dot" id="dot-upper"></span><span>1 majuscule</span></div>
            <div class="auth-check-item" id="chk-digit"><span class="check-dot" id="dot-digit"></span><span>1 chiffre</span></div>
            <div class="auth-check-item" id="chk-sym"><span class="check-dot" id="dot-sym"></span><span>1 symbole sp\u00e9cial</span></div>
          </div>
        </div>
        <div id="register-password-hint" class="auth-validation-slot text-[11px] font-mono px-1 flex items-center gap-1.5" aria-live="polite"></div>
      </div>

      <!-- CGU -->
      <div class="pt-0.5">
        <label class="flex items-start cursor-pointer select-none gap-2.5 min-h-[44px] py-1 group" for="reg-terms">
          <div class="relative flex items-center h-5 mt-0.5 shrink-0">
            <input type="checkbox" id="reg-terms" name="terms" required
              class="w-4 h-4 rounded border-outline-variant bg-surface text-primary focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer transition" />
          </div>
          <span class="font-mono text-[11px] text-on-surface-variant leading-snug group-hover:text-on-surface transition-colors">
            J\u2019accepte les <a href="#terms" class="text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded">Conditions G\u00e9n\u00e9rales</a> &amp; la <a href="#privacy" class="text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded">Politique de Confidentialit\u00e9</a>.
          </span>
        </label>
        <div class="auth-validation-slot text-[11px] font-mono px-1 hidden" id="reg-terms-hint" aria-live="polite">
          <span style="color:var(--color-error)">Veuillez accepter les conditions pour continuer.</span>
        </div>
      </div>

      <!-- Submit -->
      <div class="pt-1">
        <button type="submit" id="register-submit" class="auth-submit w-full flex items-center justify-center gap-3">
          <span id="reg-btn-text">Cr\u00e9er mon compte</span>
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" id="reg-btn-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          <div class="hidden w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" id="reg-btn-spinner"></div>
        </button>
      </div>
    </form>

    <!-- Vue succès -->
    <div id="register-success-view" class="hidden space-y-4 p-6 rounded-2xl border text-center" style="background:color-mix(in srgb, var(--color-success-container) 40%, var(--color-surface));border-color:color-mix(in srgb, var(--color-success) 30%, transparent);" aria-live="polite">
      <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-success shadow-md" style="background:color-mix(in srgb, var(--color-success) 12%, transparent);border:1px solid color-mix(in srgb, var(--color-success) 30%, transparent)">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
      </div>
      <div class="space-y-1.5">
        <h3 class="text-xl font-bold text-on-surface">Compte cr\u00e9\u00e9 avec succ\u00e8s\u00a0!</h3>
        <p class="text-xs text-on-surface-variant font-mono">Vous pouvez maintenant vous connecter \u00e0 votre espace.</p>
      </div>
      <a href="/login?next=${encodeURIComponent(safeNext)}"
        class="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl font-mono text-sm font-semibold auth-submit">
        Aller \u00e0 la connexion
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
      </a>
    </div>

    <div class="border-t border-outline-variant/30 pt-4 text-center">
      <p class="text-xs text-on-surface-variant">
        D\u00e9j\u00e0 membre de l\u2019\u00e9cosyst\u00e8me\u00a0?
        <a href="/login?next=${encodeURIComponent(safeNext)}" class="font-mono text-primary hover:underline underline-offset-4 ml-1 transition-colors">Se connecter</a>
      </p>
    </div>

    <script>
      (function() {
        var next = ${JSON.stringify(safeNext)};
        var form = document.getElementById('register-form');
        var banner = document.getElementById('register-banner');
        var successView = document.getElementById('register-success-view');
        var submitBtn = document.getElementById('register-submit');
        var btnText = document.getElementById('reg-btn-text');
        var btnIcon = document.getElementById('reg-btn-icon');
        var btnSpinner = document.getElementById('reg-btn-spinner');
        var nameInput = document.getElementById('register-display-name');
        var emailInput = document.getElementById('register-email');
        var passInput = document.getElementById('register-password');
        var termsInput = document.getElementById('reg-terms');
        var toggleBtn = document.getElementById('reg-toggle-pwd');
        var showIcon = document.getElementById('reg-icon-show');
        var hideIcon = document.getElementById('reg-icon-hide');
        var toggleText = document.getElementById('reg-toggle-text');
        var genBtn = document.getElementById('reg-gen-pwd');
        var nameValidIcon = document.getElementById('reg-name-valid-icon');
        var emailValidIcon = document.getElementById('reg-email-valid-icon');
        var submitting = false;
        var redirected = false;
        var attemptedSubmit = false;

        // ── Helpers validation (regex \s correctement échappée : 1 niveau dans TS)
        function validateEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim()); }
        function validateName(v) { return (v || '').trim().length >= 2; }

        function makeErrorHtml(msg) {
          return '<span style="color:var(--color-error)" class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5 inline-block shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' + msg + '</span>';
        }

        function setFieldState(input, validIcon, hintEl, valid, msg) {
          if (valid) {
            input.classList.remove('has-error'); input.classList.add('is-valid');
            input.removeAttribute('aria-invalid');
            if (validIcon) validIcon.classList.remove('hidden');
            if (hintEl) hintEl.innerHTML = msg ? '<span style="color:var(--color-success)" class="flex items-center gap-1">' + msg + '</span>' : '';
          } else {
            input.classList.add('has-error'); input.classList.remove('is-valid');
            input.setAttribute('aria-invalid', 'true');
            if (validIcon) validIcon.classList.add('hidden');
            if (hintEl && (attemptedSubmit || input.value.trim().length > 0)) hintEl.innerHTML = makeErrorHtml(msg);
          }
        }

        // ── Toggle visibilité MDP
        toggleBtn && toggleBtn.addEventListener('click', function() {
          var isHidden = passInput.type === 'password';
          passInput.type = isHidden ? 'text' : 'password';
          toggleBtn.setAttribute('aria-pressed', String(isHidden));
          toggleBtn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
          showIcon.classList.toggle('hidden', isHidden);
          hideIcon.classList.toggle('hidden', !isHidden);
          toggleText.textContent = isHidden ? 'Masquer' : 'Afficher';
          passInput.focus();
        });

        // ── Jauge & checklist MDP
        var segs = ['reg-str-1','reg-str-2','reg-str-3','reg-str-4'].map(function(id) { return document.getElementById(id); });
        var strengthLabel = document.getElementById('reg-strength-label');
        var chkLen = document.getElementById('chk-len'), dotLen = document.getElementById('dot-len');
        var chkUpper = document.getElementById('chk-upper'), dotUpper = document.getElementById('dot-upper');
        var chkDigit = document.getElementById('chk-digit'), dotDigit = document.getElementById('dot-digit');
        var chkSym = document.getElementById('chk-sym'), dotSym = document.getElementById('dot-sym');

        function toggleCheck(wrap, dot, active) {
          if (!wrap || !dot) return;
          wrap.classList.toggle('satisfied', active);
          dot.style.backgroundColor = active ? 'var(--color-success)' : '';
        }

        function updateStrength(v) {
          var hasLen = v.length >= 8, hasUpper = /[A-Z]/.test(v), hasDigit = /[0-9]/.test(v), hasSym = /[^A-Za-z0-9]/.test(v);
          var score = [hasLen, hasUpper, hasDigit, hasSym].filter(Boolean).length;
          if (v.length >= 12 && score >= 3) score = 4;
          toggleCheck(chkLen, dotLen, hasLen);
          toggleCheck(chkUpper, dotUpper, hasUpper);
          toggleCheck(chkDigit, dotDigit, hasDigit);
          toggleCheck(chkSym, dotSym, hasSym);
          var colors = ['', 'var(--color-error)', 'var(--color-warning, orange)', 'var(--color-primary)', 'var(--color-success)'];
          var labels = ['Saisissez un mot de passe', 'Faible', 'Mod\u00e9r\u00e9e', 'Robuste', 'Maximale'];
          segs.forEach(function(s, i) { if (s) s.style.backgroundColor = (v && i < score) ? colors[score] : ''; });
          if (strengthLabel) {
            strengthLabel.textContent = 'Force\u00a0: ' + labels[v ? score : 0];
            strengthLabel.style.color = v ? (colors[score] || '') : '';
          }
          return { isValid: hasLen && hasUpper && hasDigit && hasSym };
        }

        passInput.addEventListener('input', function() {
          this.classList.remove('has-error');
          updateStrength(this.value);
          document.getElementById('register-password-hint').innerHTML = '';
          if (banner) banner.classList.add('hidden');
        });
        passInput.addEventListener('blur', function() {
          if (this.value && !updateStrength(this.value).isValid) {
            setFieldState(passInput, null, document.getElementById('register-password-hint'), false, 'Le mot de passe ne satisfait pas toutes les exigences.');
          }
        });

        nameInput.addEventListener('blur', function() {
          if (this.value.trim()) setFieldState(nameInput, nameValidIcon, document.getElementById('register-name-hint'), validateName(this.value), validateName(this.value) ? '' : 'Le nom doit comporter au moins 2 caract\u00e8res.');
        });
        nameInput.addEventListener('input', function() {
          this.classList.remove('has-error', 'is-valid');
          if (nameValidIcon) nameValidIcon.classList.add('hidden');
          document.getElementById('register-name-hint').innerHTML = '';
          if (banner) banner.classList.add('hidden');
        });

        emailInput.addEventListener('blur', function() {
          if (this.value.trim()) {
            var ok = validateEmail(this.value);
            setFieldState(emailInput, emailValidIcon, document.getElementById('register-email-hint'), ok, ok ? 'Adresse e-mail valide \u2713' : 'Format attendu\u00a0: exemple@domaine.com');
          }
        });
        emailInput.addEventListener('input', function() {
          this.classList.remove('has-error', 'is-valid');
          if (emailValidIcon) emailValidIcon.classList.add('hidden');
          var hint = document.getElementById('register-email-hint');
          if (hint) hint.innerHTML = '<span class="text-on-surface-variant/60 text-[10.5px]">Une fois le compte cr\u00e9\u00e9, vous pourrez vous connecter imm\u00e9diatement.</span>';
          if (banner) banner.classList.add('hidden');
        });

        genBtn && genBtn.addEventListener('click', function() {
          var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
          var pwd = 'M' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(97 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 10) + '!#';
          for (var i = 0; i < 8; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
          passInput.value = pwd;
          passInput.type = 'text';
          showIcon.classList.add('hidden'); hideIcon.classList.remove('hidden'); toggleText.textContent = 'Masquer';
          toggleBtn && toggleBtn.setAttribute('aria-pressed', 'true');
          updateStrength(pwd);
          passInput.focus();
        });

        function showBanner(msg, type) {
          if (!banner) return;
          banner.innerHTML = msg;
          banner.className = 'p-3.5 rounded-xl font-mono text-xs border transition-all ' + (
            type === 'error'   ? 'bg-error-container border-error/30 text-error' :
            type === 'warning' ? 'bg-warning-container border-warning/30 text-warning' :
                                 'bg-success-container border-success/30 text-success'
          );
          banner.classList.remove('hidden');
        }

        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          if (submitting || redirected) return;
          attemptedSubmit = true;

          var nameOk = validateName(nameInput.value);
          var emailOk = validateEmail(emailInput.value);
          var pwdOk = updateStrength(passInput.value).isValid;
          var termsOk = termsInput.checked;

          setFieldState(nameInput, nameValidIcon, document.getElementById('register-name-hint'), nameOk, nameOk ? '' : 'Le nom doit comporter au moins 2 caract\u00e8res.');
          setFieldState(emailInput, emailValidIcon, document.getElementById('register-email-hint'), emailOk, emailOk ? 'Adresse e-mail valide \u2713' : 'Format attendu\u00a0: exemple@domaine.com');
          if (!pwdOk) setFieldState(passInput, null, document.getElementById('register-password-hint'), false, 'Le mot de passe ne satisfait pas toutes les exigences.');
          var termsHint = document.getElementById('reg-terms-hint');
          if (!termsOk) termsHint.classList.remove('hidden'); else termsHint.classList.add('hidden');

          if (!nameOk || !emailOk || !pwdOk || !termsOk) {
            showBanner('Veuillez renseigner correctement les champs requis.', 'error');
            if (!nameOk) nameInput.focus(); else if (!emailOk) emailInput.focus(); else if (!pwdOk) passInput.focus(); else termsInput.focus();
            return;
          }

          submitting = true;
          if (banner) banner.classList.add('hidden');
          submitBtn.disabled = true;
          btnText.textContent = 'Cr\u00e9ation en cours\u2026';
          btnIcon.classList.add('hidden');
          btnSpinner.classList.remove('hidden');

          try {
            var res = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailInput.value, password: passInput.value, displayName: nameInput.value })
            });
            if (res.ok) {
              redirected = true;
              form.classList.add('hidden');
              successView.classList.remove('hidden');
            } else {
              var data = await res.json().catch(function() { return {}; });
              if (res.status === 409) {
                showBanner('Un compte existe d\u00e9j\u00e0 avec <strong>' + emailInput.value + '</strong>. <a href="/login?next=' + encodeURIComponent(next) + '" class="underline font-semibold ml-1">Se connecter \u2192</a>', 'warning');
              } else {
                showBanner(data.error || 'Erreur lors de la cr\u00e9ation du compte. R\u00e9essayez.', 'error');
              }
            }
          } catch (ex) {
            showBanner('Service momentan\u00e9ment indisponible. Aucune donn\u00e9e saisie n\u2019a \u00e9t\u00e9 perdue.', 'error');
          } finally {
            if (!redirected) {
              submitBtn.disabled = false;
              btnText.textContent = 'Cr\u00e9er mon compte';
              btnIcon.classList.remove('hidden');
              btnSpinner.classList.add('hidden');
              submitting = false;
            }
          }
        });
      })();
    </script>`;

  return authShell("Inscription", activeMode, sharedStyles, formHtml);
}
