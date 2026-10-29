/**
 * @shell/pages — Pages d'authentification publiques (connexion + inscription).
 *
 * Contrats préservés :
 *   - POST /api/auth/login    { email, password }
 *   - POST /api/auth/register { email, password, displayName }
 *   - exports : renderLoginPage, renderRegisterPage, AuthPageOptions
 *
 * Principes de cette version :
 *   - Le rendu serveur reste inchangé (chaînes HTML), mais la logique client
 *     commune (validation, bannières, POST, bascule MDP) est factorisée dans
 *     un unique runtime `window.MxAuth` injecté une seule fois.
 *   - Aucun `innerHTML` alimenté par des données utilisateur ou serveur :
 *     tout passe par `textContent` / nœuds DOM.
 *   - Animations : transform/opacity/couleurs uniquement, durées centralisées
 *     en variables CSS (--auth-dur-*), `prefers-reduced-motion` respecté.
 *   - Transition entre Connexion/Inscription : CSS View Transitions
 *     (amélioration progressive, zéro JS, ignorée si non supportée).
 *
 * Tokens : variables CSS du design system MosaiX (theme-aware).
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
  /**
   * Chemins internes (commençant par "/") — optionnels. Tant qu'ils ne sont pas
   * fournis, le lien correspondant n'est PAS rendu (pas de lien mort).
   */
  recoveryHref?: string;
  termsHref?: string;
  privacyHref?: string;
}

// ─── Utilitaires serveur ─────────────────────────────────────────────────────

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** JSON sûr pour inclusion dans un <script> (neutralise `</script>`, `<!--`, U+2028/9). */
function jsonForScript(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Accepte uniquement un chemin interne ("/x"), jamais "//host" ni URL absolue. */
function internalHref(h?: string): string | undefined {
  if (!h) return undefined;
  return h.startsWith("/") && !h.startsWith("//") && !h.includes("\\")
    ? h
    : undefined;
}

function icon(d: string, cls = "w-4 h-4 shrink-0", sw = 2): string {
  return `<svg class="${cls}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="${sw}" d="${d}"/></svg>`;
}

const ICON = {
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  bolt: "M13 10V3L4 14h7v7l9-11h-7z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  mail: "M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206",
  check: "M5 13l4 4L19 7",
  arrow: "M14 5l7 7m0 0l-7 7m7-7H3",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  eyeOff:
    "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18",
  shield:
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
};

// ─── Styles spécifiques aux pages auth ───────────────────────────────────────
// Durées/courbes centralisées. Repères : micro 140 ms, champs 180 ms,
// états/messages 200 ms, changement de vue 240 ms.
const AUTH_EXTRA_STYLES = `<style>
  :root {
    --auth-dur-micro: 140ms;
    --auth-dur-field: 180ms;
    --auth-dur-state: 200ms;
    --auth-dur-view: 240ms;
    --auth-ease: cubic-bezier(0.2, 0, 0, 1);
  }

  .auth-sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  .auth-skip {
    position: absolute; left: 0.75rem; top: 0.75rem; z-index: 50;
    padding: 0.5rem 0.75rem; border-radius: 0.5rem;
    background: var(--color-surface); color: var(--color-on-surface);
    border: 1px solid var(--color-outline-variant);
    transform: translateY(-200%);
  }
  .auth-skip:focus { transform: translateY(0); }

  /* Champs : transitions limitées aux couleurs / ombres */
  .auth-floating input {
    transition: border-color var(--auth-dur-field) var(--auth-ease),
                box-shadow var(--auth-dur-field) var(--auth-ease),
                background-color var(--auth-dur-field) var(--auth-ease);
  }
  .auth-floating input:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Label flottant (l'input précède label et icône dans le DOM → sélecteur ~ valide) */
  .auth-label-with-icon {
    position: absolute; left: 2.75rem; top: 50%;
    transform: translateY(-50%);
    transform-origin: left center;
    pointer-events: none; user-select: none; white-space: nowrap;
    font-size: 0.875rem; color: var(--color-on-surface-variant);
    transition: top var(--auth-dur-field) var(--auth-ease),
                transform var(--auth-dur-field) var(--auth-ease),
                color var(--auth-dur-field) var(--auth-ease);
  }
  .auth-floating input:focus ~ .auth-label-with-icon,
  .auth-floating input:not(:placeholder-shown) ~ .auth-label-with-icon,
  .auth-floating input:-webkit-autofill ~ .auth-label-with-icon {
    top: 0.5rem;
    transform: translateY(0) scale(0.8);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--color-primary);
  }
  .auth-floating input.has-error ~ .auth-label-with-icon { color: var(--color-error); }

  /* Icône de champ : réactive en CSS pur (plus de JS focus/blur) */
  .auth-floating .auth-field-icon { transition: color var(--auth-dur-field) var(--auth-ease); }
  .auth-floating input:focus ~ .auth-field-icon { color: var(--color-primary); }
  .auth-floating input.is-valid ~ .auth-field-icon { color: var(--color-success); }
  .auth-floating input.has-error ~ .auth-field-icon { color: var(--color-error); }

  /* Messages : emplacement réservé (pas de saut de mise en page) + fondu */
  .auth-validation-slot { min-height: 1.125rem; color: var(--color-on-surface-variant); }
  .auth-hint-msg { display: inline-flex; align-items: center; gap: 0.375rem; animation: authFadeIn var(--auth-dur-state) var(--auth-ease); }
  .auth-hint-error { color: var(--color-error); }
  .auth-hint-ok { color: var(--color-success); }
  .auth-banner-in { animation: authFadeIn var(--auth-dur-state) var(--auth-ease); }
  @keyframes authFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Boutons */
  .auth-submit {
    transition: background-color var(--auth-dur-field) var(--auth-ease),
                box-shadow var(--auth-dur-field) var(--auth-ease),
                opacity var(--auth-dur-field) var(--auth-ease),
                transform var(--auth-dur-micro) var(--auth-ease);
  }
  .auth-submit:active:not([aria-disabled="true"]) { transform: scale(0.985); }
  .auth-submit:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .auth-submit[aria-disabled="true"] { cursor: progress; opacity: 0.8; }

  /* Jauge + checklist (état non porté par la seule couleur : coche + texte masqué) */
  .auth-strength-meter .str-seg { transition: background-color var(--auth-dur-state) var(--auth-ease); }
  #reg-pwd-checklist { list-style: none; padding: 0; margin: 0; }
  .auth-check-item { display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--color-on-surface-variant); }
  .auth-check-item .check-dot {
    display: inline-flex; align-items: center; justify-content: center; flex: none;
    width: 0.875rem; height: 0.875rem; border-radius: 9999px;
    border: 1px solid var(--color-outline-variant);
    font-size: 0.625rem; line-height: 1; color: var(--color-on-primary);
    transition: background-color var(--auth-dur-state) var(--auth-ease), border-color var(--auth-dur-state) var(--auth-ease);
  }
  .auth-check-item.satisfied { color: var(--color-on-surface); }
  .auth-check-item.satisfied .check-dot { border-color: var(--color-success); }

  .auth-frame { overflow: visible; }

  /* Transition entre vues (navigation réelle) — amélioration progressive */
  @media (prefers-reduced-motion: no-preference) {
    @view-transition { navigation: auto; }
    .auth-frame { view-transition-name: auth-panel; }
    ::view-transition-old(auth-panel) { animation: authOut 120ms ease-in both; }
    ::view-transition-new(auth-panel) { animation: authIn var(--auth-dur-view) var(--auth-ease) both; }
    ::view-transition-group(auth-panel) { animation-duration: var(--auth-dur-view); animation-timing-function: var(--auth-ease); }
    @keyframes authOut { to { opacity: 0; } }
    @keyframes authIn  { from { opacity: 0; transform: translateY(6px); } }
  }

  /* Réduction des animations : mouvement supprimé, information conservée par le texte */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    .auth-spinner { animation-duration: 1.5s !important; animation-iteration-count: infinite !important; }
  }
</style>`;

// ─── Runtime client commun (injecté une seule fois) ──────────────────────────
// NB : volontairement sans antislash ni backtick pour rester sûr dans un
// template literal TypeScript.
const AUTH_CLIENT_RUNTIME = `<script>
(function () {
  var ICON_ERR = '<svg class="w-3.5 h-3.5 shrink-0" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  var ICON_OK = '<svg class="w-3.5 h-3.5 shrink-0" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';

  function isEmail(v) {
    v = (v || '').trim();
    var at = v.indexOf('@'), dot = v.lastIndexOf('.');
    return at > 0 && v.indexOf('@', at + 1) < 0 && v.indexOf(' ') < 0 && dot > at + 1 && dot < v.length - 1;
  }

  // Défense en profondeur : le serveur valide déjà "next", on re-vérifie avant redirection.
  function safeNext(n) {
    var bs = String.fromCharCode(92);
    return (typeof n === 'string' && n.charAt(0) === '/' && n.charAt(1) !== '/' && n.charAt(1) !== bs) ? n : '/';
  }

  // kind : 'error' | 'ok' | 'clear'. Texte injecté via nœuds DOM uniquement.
  function setHint(hint, kind, msg) {
    if (!hint) return;
    hint.textContent = '';
    if (kind === 'clear') { hint.textContent = hint.getAttribute('data-default') || ''; return; }
    if (kind === 'ok' && !msg) return;
    var s = document.createElement('span');
    s.className = 'auth-hint-msg auth-hint-' + kind;
    s.innerHTML = kind === 'error' ? ICON_ERR : ICON_OK; // constantes statiques de confiance
    s.appendChild(document.createTextNode(msg));
    hint.appendChild(s);
  }

  function setFieldState(input, validIcon, hint, kind, msg) {
    input.classList.toggle('has-error', kind === 'error');
    input.classList.toggle('is-valid', kind === 'ok');
    if (kind === 'error') input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    if (validIcon) validIcon.classList.toggle('hidden', kind !== 'ok');
    setHint(hint, kind, msg);
  }

  var BANNER = {
    error:   { label: 'Erreur\u00a0: ',    cls: 'bg-error-container border-error/30 text-error' },
    warning: { label: 'Attention\u00a0: ', cls: 'bg-warning-container border-warning/30 text-warning' },
    success: { label: '',                  cls: 'bg-success-container border-success/30 text-success' }
  };

  function showBanner(el, msg, type, linkText, linkHref) {
    if (!el) return;
    var b = BANNER[type] || BANNER.error;
    el.textContent = '';
    if (b.label) { var st = document.createElement('strong'); st.textContent = b.label; el.appendChild(st); }
    el.appendChild(document.createTextNode(msg));
    if (linkText) {
      var a = document.createElement('a');
      a.href = linkHref; a.className = 'underline font-semibold ml-1'; a.textContent = linkText;
      el.appendChild(a);
    }
    el.className = 'auth-banner-in p-3.5 rounded-xl font-mono text-xs border ' + b.cls;
  }
  function hideBanner(el) { if (el) el.className = 'hidden'; }

  // aria-disabled (et non disabled) : le focus n'est pas perdu, mais la soumission est bloquée.
  function setBusy(ui, busy) {
    ui.btn.setAttribute('aria-disabled', busy ? 'true' : 'false');
    ui.btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    ui.text.textContent = busy ? ui.busyLabel : ui.idleLabel;
    ui.icon.classList.toggle('hidden', busy);
    ui.spinner.classList.toggle('hidden', !busy);
    if (ui.status) ui.status.textContent = busy ? ui.busyLabel : '';
  }

  async function postJson(url, body, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 15000);
    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      var data = await res.json().catch(function () { return {}; });
      return { res: res, data: data };
    } finally { clearTimeout(timer); }
  }

  function errorMessage(r, fallback) {
    var s = r.res.status;
    if (s === 429) {
      var ra = parseInt(r.res.headers.get('Retry-After'), 10);
      return 'Trop de tentatives. R\u00e9essayez ' + (ra > 0 && ra < 3600 ? 'dans ' + ra + '\u00a0s.' : 'dans quelques instants.');
    }
    if (s >= 500) return 'Le service rencontre un probl\u00e8me. R\u00e9essayez dans un instant.';
    var e = r.data && r.data.error;
    return (typeof e === 'string' && e && e.length <= 200) ? e : fallback;
  }

  function networkMessage(err) {
    if (err && err.name === 'AbortError') return 'Le serveur met trop de temps \u00e0 r\u00e9pondre. R\u00e9essayez.';
    if (navigator.onLine === false) return 'Vous semblez hors ligne. V\u00e9rifiez votre connexion puis r\u00e9essayez.';
    return 'Service momentan\u00e9ment indisponible. Vos saisies sont conserv\u00e9es\u00a0; r\u00e9essayez.';
  }

  // Le libellé accessible suit le libellé visible (WCAG 2.5.3) ; le focus reste sur le bouton.
  function bindPasswordToggle(input, btn, showI, hideI, text) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      var hide = input.type === 'password';
      input.type = hide ? 'text' : 'password';
      btn.setAttribute('aria-label', hide ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      showI.classList.toggle('hidden', hide);
      hideI.classList.toggle('hidden', !hide);
      text.textContent = hide ? 'Masquer' : 'Afficher';
    });
  }

  window.MxAuth = Object.freeze({
    isEmail: isEmail, safeNext: safeNext, setHint: setHint, setFieldState: setFieldState,
    showBanner: showBanner, hideBanner: hideBanner, setBusy: setBusy, postJson: postJson,
    errorMessage: errorMessage, networkMessage: networkMessage, bindPasswordToggle: bindPasswordToggle
  });
})();
</script>`;

// ─── Colonne éditoriale (décorative, masquée < lg) ───────────────────────────
function editorialColumn(): string {
  return `
    <aside class="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between border-r border-outline-variant/20 bg-surface-container-low/50 p-12 auth-bg-grid relative">
      <div class="flex items-center gap-2 text-on-surface-variant">
        <span aria-hidden="true" class="w-2 h-2 rounded-full bg-primary"></span>
        <span class="text-xs font-mono">MosaiX Gateway</span>
      </div>

      <div class="space-y-8 my-auto py-10">
        <div aria-hidden="true" class="relative w-fit p-5 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-lg auth-crosshair">
          <div class="grid grid-cols-2 gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary"></div>
            <div class="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/40"></div>
            <div class="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/40"></div>
            <div class="w-8 h-8 rounded-lg bg-secondary opacity-80"></div>
          </div>
        </div>

        <div class="space-y-3">
          <p class="text-3xl xl:text-4xl font-bold text-on-surface tracking-tight leading-tight">
            L'écosystème <span class="text-primary">modulaire.</span>
          </p>
          <p class="text-sm text-on-surface-variant leading-relaxed max-w-sm">
            Espaces connectés, composables et orchestrés. Un compte unique, un accès unifié.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 max-w-sm">
          <div class="p-3 rounded-xl bg-surface-container border border-outline-variant/20">
            <div class="flex items-center gap-2 text-xs font-mono text-primary mb-1">
              ${icon(ICON.lock, "w-3.5 h-3.5 shrink-0")}<span>Compte unique</span>
            </div>
            <p class="text-xs text-on-surface-variant leading-snug">Un seul accès pour tous vos espaces.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface-container border border-outline-variant/20">
            <div class="flex items-center gap-2 text-xs font-mono text-primary mb-1">
              ${icon(ICON.bolt, "w-3.5 h-3.5 shrink-0")}<span>Modulaire</span>
            </div>
            <p class="text-xs text-on-surface-variant leading-snug">Espaces connectés et configurables.</p>
          </div>
        </div>
      </div>

      <div class="text-xs font-mono text-on-surface-variant flex items-center justify-between">
        <span>MosaiX Platform — accès membre</span>
        <span>${new Date().getFullYear()}</span>
      </div>
    </aside>`;
}

// ─── Navigation Connexion / Créer un compte (vraie navigation href) ──────────
function tabSwitcher(active: "login" | "register", safeNext: string): string {
  const loginActive = active === "login";
  const q = encodeURIComponent(safeNext);
  const link = (href: string, label: string, isActive: boolean) => `
      <a href="${href}?next=${q}"${isActive ? ' aria-current="page"' : ""}
         class="relative z-10 flex-1 min-h-[44px] px-3 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"}">
        <span aria-hidden="true" class="w-1.5 h-1.5 rounded-full ${isActive ? "bg-primary" : "bg-outline-variant"}"></span>
        ${label}
      </a>`;
  return `
    <nav aria-label="Mode d'accès" class="relative p-1 bg-surface-container-high rounded-xl border border-outline-variant/30 flex items-center">
      <div aria-hidden="true" class="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-surface border border-outline-variant/40 shadow-sm"
           style="transform:translateX(${loginActive ? "0" : "100"}%)"></div>
      ${link("/login", "Connexion", loginActive)}
      ${link("/register", "Créer un compte", !loginActive)}
    </nav>`;
}

/**
 * Champ à label flottant + icône gauche.
 * Ordre DOM impératif (sélecteurs `input ~ label` / `input ~ .auth-field-icon`) :
 * input → label → icône → icône de validité → contenu `afterInput`.
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
  extraAttrs = "",
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
  extraAttrs?: string;
  label: string;
  iconPath: string;
  validIconId?: string;
  hintId?: string;
  ariaDescribedBy?: string;
  /** HTML inséré après l'icône de champ (ex : bouton afficher/masquer MDP) */
  afterInput?: string;
}): string {
  const inputmodeAttr = inputmode ? ` inputmode="${inputmode}"` : "";
  const describedBy = ariaDescribedBy
    ? ` aria-describedby="${ariaDescribedBy}"`
    : hintId
      ? ` aria-describedby="${hintId}"`
      : "";
  const validIconHtml = validIconId
    ? `<div aria-hidden="true" class="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none hidden text-success" id="${validIconId}">${icon(ICON.check, "w-4 h-4", 2.5)}</div>`
    : "";

  return `<div class="auth-floating relative">
    <input id="${id}" name="${name}" type="${type}"${required ? ' required aria-required="true"' : ""} autocomplete="${autocomplete}"
      placeholder="${placeholder}"${inputmodeAttr} ${extraAttrs}
      class="auth-input block w-full pl-11 ${extraInputClass} pt-5 pb-2"${describedBy}/>
    <label for="${id}" class="auth-label-with-icon">${label}</label>
    <div class="auth-field-icon absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
      ${icon(iconPath)}
    </div>
    ${validIconHtml}
    ${afterInput}
  </div>`;
}

function passwordToggle(prefix: string): string {
  return `
    <button type="button" id="${prefix}-toggle-pwd" aria-label="Afficher le mot de passe" aria-pressed="false"
      class="absolute inset-y-0 right-0 pr-3 pl-2 flex items-center gap-1.5 text-xs font-mono text-on-surface-variant hover:text-on-surface transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-r-xl">
      <span id="${prefix}-icon-show">${icon(ICON.eye)}</span>
      <span id="${prefix}-icon-hide" class="hidden">${icon(ICON.eyeOff)}</span>
      <span class="select-none" id="${prefix}-toggle-text">Afficher</span>
    </button>`;
}

function submitButton(prefix: string, id: string, label: string): string {
  return `
    <button type="submit" id="${id}" class="auth-submit w-full min-h-[48px] flex items-center justify-center gap-3" aria-disabled="false">
      <span id="${prefix}-btn-text">${label}</span>
      <span id="${prefix}-btn-icon">${icon(ICON.arrow, "w-4 h-4 shrink-0", 2.5)}</span>
      <span class="auth-spinner hidden w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" id="${prefix}-btn-spinner" aria-hidden="true"></span>
    </button>`;
}

// ─── Shell commun ────────────────────────────────────────────────────────────
function authShell(
  title: string,
  activeMode: ThemeMode,
  sharedStyles: string,
  formHtml: string,
): string {
  return `<!DOCTYPE html>
<html class="${activeMode === "dark" ? "dark" : activeMode === "high-contrast" ? "high-contrast" : ""}" lang="fr" data-theme-mode="${activeMode}">
<head>
<!-- Fragments de confiance internes : style compilé themes/*.json + CSS partagé renderer (jamais de données utilisateur brutes). -->
${renderHeadBlock(title, activeMode, renderThemeStyleTag(activeMode), sharedStyles)}
  ${getShellClientScripts()}
  ${AUTH_EXTRA_STYLES}
</head>
<body class="bg-background text-on-surface min-h-screen font-sans antialiased">
  <a href="#auth-main" class="auth-skip text-sm">Aller au formulaire</a>
  ${AUTH_CLIENT_RUNTIME}
  <div class="min-h-screen flex">
    ${editorialColumn()}
    <main id="auth-main" class="flex-1 flex items-center justify-center p-4 lg:p-8 auth-bg-grid">
      <div class="w-full max-w-md space-y-5">
        <a href="/commerce" class="flex lg:hidden items-center justify-center gap-2 group mb-2">
          <span aria-hidden="true" class="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold">M</span>
          <span class="font-bold text-on-surface group-hover:text-primary transition-colors text-sm">MosaiX Platform</span>
        </a>

        <div class="glass-card auth-frame auth-crosshair p-6 sm:p-8 space-y-6">
          <noscript>
            <p role="alert" class="p-3.5 rounded-xl font-mono text-xs border bg-error-container border-error/30 text-error">
              JavaScript est requis pour utiliser ce formulaire.
            </p>
          </noscript>
          ${formHtml}
        </div>

        <p class="text-center text-xs text-on-surface-variant lg:hidden">
          <a href="/commerce" class="inline-flex items-center min-h-[44px] hover:text-on-surface transition-colors">← Retour à la vitrine</a>
        </p>
      </div>
    </main>
  </div>
</body>
</html>`;
}

// ─── Page Connexion ──────────────────────────────────────────────────────────
export function renderLoginPage(opts: AuthPageOptions): string {
  const { activeMode, sharedStyles, safeNext } = opts;
  const recovery = internalHref(opts.recoveryHref);

  const formHtml = `
    ${tabSwitcher("login", safeNext)}

    <div class="space-y-1">
      <h1 class="text-2xl font-bold text-on-surface tracking-tight">Bon retour</h1>
      <p class="text-sm text-on-surface-variant">Accédez à votre fil, vos espaces et vos commandes.</p>
    </div>

    <div id="login-banner" role="alert" class="hidden"></div>
    <p id="login-status" class="auth-sr-only" role="status" aria-live="polite"></p>

    <!-- method="post" : si JS échoue, les identifiants ne finissent jamais dans l'URL -->
    <form id="login-form" method="post" action="/login" class="space-y-4" autocomplete="on" novalidate>

      <div class="space-y-1">
        ${floatingField({
          id: "login-email",
          name: "email",
          type: "email",
          autocomplete: "username",
          inputmode: "email",
          extraAttrs: 'autocapitalize="none" spellcheck="false"',
          label: "Adresse e-mail",
          iconPath: ICON.mail,
          validIconId: "login-email-valid-icon",
          hintId: "login-email-hint",
          extraInputClass: "pr-10",
        })}
        <div id="login-email-hint" class="auth-validation-slot text-xs font-mono px-1" aria-live="polite"></div>
      </div>

      <div class="space-y-1">
        ${floatingField({
          id: "login-password",
          name: "password",
          type: "password",
          autocomplete: "current-password",
          label: "Mot de passe",
          iconPath: ICON.lock,
          hintId: "login-password-hint",
          extraInputClass: "pr-24 font-mono",
          afterInput: passwordToggle("login"),
        })}
        <div id="login-password-hint" class="auth-validation-slot text-xs font-mono px-1" aria-live="polite"></div>
        ${
          recovery
            ? `<div class="flex justify-end"><a href="${escAttr(recovery)}" class="inline-flex items-center min-h-[32px] text-xs font-mono text-primary hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Mot de passe oublié ?</a></div>`
            : ""
        }
      </div>

      <div class="pt-1">
        ${submitButton("login", "login-submit", "Se connecter")}
      </div>
    </form>

    <div class="border-t border-outline-variant/30 pt-4 text-center">
      <p class="text-sm text-on-surface-variant">
        Nouveau sur l'écosystème ?
        <a href="/register?next=${encodeURIComponent(safeNext)}" class="inline-flex items-center min-h-[44px] font-mono text-primary hover:underline underline-offset-4 ml-1">Créer un compte</a>
      </p>
    </div>

    <script>
      (function () {
        var A = window.MxAuth; if (!A) return;
        var next = A.safeNext(${jsonForScript(safeNext)});
        var $ = function (id) { return document.getElementById(id); };
        var form = $('login-form'), banner = $('login-banner');
        var email = $('login-email'), pass = $('login-password');
        var emailHint = $('login-email-hint'), passHint = $('login-password-hint');
        var emailIcon = $('login-email-valid-icon');
        var ui = {
          btn: $('login-submit'), text: $('login-btn-text'), icon: $('login-btn-icon'),
          spinner: $('login-btn-spinner'), status: $('login-status'),
          idleLabel: 'Se connecter', busyLabel: 'Vérification…'
        };
        var busy = false, redirecting = false;

        A.bindPasswordToggle(pass, $('login-toggle-pwd'), $('login-icon-show'), $('login-icon-hide'), $('login-toggle-text'));

        function emailState() {
          var ok = A.isEmail(email.value);
          A.setFieldState(email, emailIcon, emailHint, ok ? 'ok' : 'error',
            ok ? 'Adresse e-mail valide' : 'Format attendu\\u00a0: exemple@domaine.com');
          return ok;
        }
        email.addEventListener('blur', function () {
          if (email.value.trim()) emailState(); else A.setFieldState(email, emailIcon, emailHint, 'clear');
        });
        email.addEventListener('input', function () {
          A.setFieldState(email, emailIcon, emailHint, 'clear'); A.hideBanner(banner);
        });
        pass.addEventListener('input', function () {
          A.setFieldState(pass, null, passHint, 'clear'); A.hideBanner(banner);
        });

        // Retour via l'historique (bfcache) : on ne laisse pas le bouton figé.
        window.addEventListener('pageshow', function (e) {
          if (e.persisted) { redirecting = false; busy = false; A.setBusy(ui, false); }
        });

        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          if (busy) return;

          var emailOk = emailState();
          var passOk = pass.value.length > 0;
          if (!passOk) A.setFieldState(pass, null, passHint, 'error', 'Saisissez votre mot de passe.');
          if (!emailOk) { email.focus(); return; }
          if (!passOk) { pass.focus(); return; }

          busy = true; A.hideBanner(banner); A.setBusy(ui, true);
          try {
            var r = await A.postJson('/api/auth/login', { email: email.value.trim(), password: pass.value });
            if (r.res.ok) {
              redirecting = true;
              A.showBanner(banner, 'Connexion réussie. Redirection…', 'success');
              window.location.assign(next);
              return;
            }
            A.showBanner(banner, A.errorMessage(r, 'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.'), 'error');
            if (r.res.status < 500 && r.res.status !== 429) {
              pass.classList.add('has-error'); pass.setAttribute('aria-invalid', 'true'); pass.focus();
            }
          } catch (ex) {
            A.showBanner(banner, A.networkMessage(ex), 'error');
          } finally {
            if (!redirecting) { busy = false; A.setBusy(ui, false); }
          }
        });
      })();
    </script>`;

  return authShell("Connexion", activeMode, sharedStyles, formHtml);
}

// ─── Page Inscription ────────────────────────────────────────────────────────
const PWD_CHECKS: ReadonlyArray<{ id: string; label: string; note: string }> = [
  { id: "len", label: "8 caractères minimum", note: "requis" },
  { id: "long", label: "12 caractères ou plus", note: "conseillé" },
  { id: "case", label: "Majuscules et minuscules", note: "conseillé" },
  { id: "mix", label: "Un chiffre ou un symbole", note: "conseillé" },
];

export function renderRegisterPage(opts: AuthPageOptions): string {
  const { activeMode, sharedStyles, safeNext } = opts;
  const terms = internalHref(opts.termsHref);
  const privacy = internalHref(opts.privacyHref);

  const linkOrText = (href: string | undefined, label: string) =>
    href
      ? `<a href="${escAttr(href)}" class="text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">${label}</a>`
      : label;

  const checklist = PWD_CHECKS.map(
    (c) => `<li class="auth-check-item" id="chk-${c.id}">
              <span class="check-dot" aria-hidden="true"></span>
              <span>${c.label} <span class="opacity-80">(${c.note})</span></span>
              <span class="auth-sr-only" data-state> — non satisfait</span>
            </li>`,
  ).join("");

  const req = `<span aria-hidden="true" class="text-primary">*</span>`;

  const formHtml = `
    ${tabSwitcher("register", safeNext)}

    <div class="space-y-1">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-bold text-on-surface tracking-tight">Créer votre compte</h1>
        <span class="text-xs font-mono px-2 py-0.5 rounded bg-surface-container text-primary border border-outline-variant/30">Gratuit</span>
      </div>
      <p class="text-sm text-on-surface-variant">Rejoignez le réseau modulaire MosaiX. Aucune carte bancaire requise.</p>
    </div>

    <div id="register-banner" role="alert" tabindex="-1" class="hidden"></div>
    <p id="register-status" class="auth-sr-only" role="status" aria-live="polite"></p>

    <form id="register-form" method="post" action="/register" class="space-y-4" autocomplete="on" novalidate>
      <p class="text-xs text-on-surface-variant font-mono">${req} Champs obligatoires</p>

      <div class="space-y-1">
        ${floatingField({
          id: "register-display-name",
          name: "displayName",
          type: "text",
          autocomplete: "name",
          label: `Nom d’affichage ${req}`,
          iconPath: ICON.user,
          validIconId: "reg-name-valid-icon",
          hintId: "register-name-hint",
          extraInputClass: "pr-10",
        })}
        <div id="register-name-hint" class="auth-validation-slot text-xs font-mono px-1" aria-live="polite"></div>
      </div>

      <div class="space-y-1">
        ${floatingField({
          id: "register-email",
          name: "email",
          type: "email",
          autocomplete: "username",
          inputmode: "email",
          extraAttrs: 'autocapitalize="none" spellcheck="false"',
          label: `Adresse e-mail ${req}`,
          iconPath: ICON.mail,
          validIconId: "reg-email-valid-icon",
          hintId: "register-email-hint",
          extraInputClass: "pr-10",
        })}
        <div id="register-email-hint" class="auth-validation-slot text-xs font-mono px-1" aria-live="polite"
             data-default="Une fois le compte créé, vous pourrez vous connecter immédiatement.">Une fois le compte créé, vous pourrez vous connecter immédiatement.</div>
      </div>

      <div class="space-y-1.5">
        <div class="flex justify-end">
          <button type="button" id="reg-gen-pwd"
            class="inline-flex items-center gap-1 min-h-[32px] text-xs font-mono text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            ${icon(ICON.bolt, "w-3 h-3")}Générer un mot de passe fort
          </button>
        </div>
        ${floatingField({
          id: "register-password",
          name: "password",
          type: "password",
          autocomplete: "new-password",
          label: `Mot de passe ${req}`,
          iconPath: ICON.lock,
          hintId: "register-password-hint",
          ariaDescribedBy:
            "reg-strength-label reg-pwd-checklist register-password-hint",
          extraInputClass: "pr-24 font-mono",
          afterInput: passwordToggle("reg"),
        })}

        <div class="space-y-1.5 px-0.5">
          <div class="flex items-center justify-between gap-3">
            <div aria-hidden="true" class="auth-strength-meter" id="reg-strength-meter">
              <div class="str-seg" id="reg-str-1"></div>
              <div class="str-seg" id="reg-str-2"></div>
              <div class="str-seg" id="reg-str-3"></div>
              <div class="str-seg" id="reg-str-4"></div>
            </div>
            <span class="text-xs font-mono text-on-surface-variant" id="reg-strength-label">Force : saisissez un mot de passe</span>
          </div>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 pt-0.5" id="reg-pwd-checklist" aria-label="Critères du mot de passe">
            ${checklist}
          </ul>
        </div>
        <div id="register-password-hint" class="auth-validation-slot text-xs font-mono px-1" aria-live="polite"></div>
      </div>

      <div>
        <label class="flex items-start cursor-pointer select-none gap-2.5 min-h-[44px] py-1" for="reg-terms">
          <span class="relative flex items-center h-5 mt-0.5 shrink-0">
            <input type="checkbox" id="reg-terms" name="terms" required aria-required="true" aria-describedby="reg-terms-hint"
              class="w-5 h-5 rounded border-outline-variant bg-surface text-primary focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer" />
          </span>
          <span class="font-mono text-xs text-on-surface-variant leading-snug">
            J’accepte les ${linkOrText(terms, "Conditions Générales")} &amp; la ${linkOrText(privacy, "Politique de Confidentialité")}. ${req}
          </span>
        </label>
        <div class="auth-validation-slot text-xs font-mono px-1" id="reg-terms-hint" aria-live="polite"></div>
      </div>

      <div class="pt-1">
        ${submitButton("reg", "register-submit", "Créer mon compte")}
      </div>
    </form>

    <div id="register-success-view" class="hidden space-y-4 p-6 rounded-2xl border text-center auth-banner-in" style="background:color-mix(in srgb, var(--color-success-container) 40%, var(--color-surface));border-color:color-mix(in srgb, var(--color-success) 30%, transparent);">
      <div aria-hidden="true" class="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-success" style="background:color-mix(in srgb, var(--color-success) 12%, transparent);border:1px solid color-mix(in srgb, var(--color-success) 30%, transparent)">
        ${icon(ICON.check, "w-6 h-6", 2.5)}
      </div>
      <div class="space-y-1.5">
        <h2 id="register-success-title" tabindex="-1" class="text-xl font-bold text-on-surface focus:outline-none">Compte créé avec succès !</h2>
        <p class="text-sm text-on-surface-variant">Vous pouvez maintenant vous connecter à votre espace.</p>
      </div>
      <a href="/login?next=${encodeURIComponent(safeNext)}"
        class="auth-submit inline-flex items-center justify-center gap-2 w-full min-h-[48px] px-6 rounded-xl font-mono text-sm font-semibold">
        Aller à la connexion
        ${icon(ICON.arrow, "w-4 h-4", 2.5)}
      </a>
    </div>

    <div class="border-t border-outline-variant/30 pt-4 text-center">
      <p class="text-sm text-on-surface-variant">
        Déjà membre de l’écosystème ?
        <a href="/login?next=${encodeURIComponent(safeNext)}" class="inline-flex items-center min-h-[44px] font-mono text-primary hover:underline underline-offset-4 ml-1">Se connecter</a>
      </p>
    </div>

    <script>
      (function () {
        var A = window.MxAuth; if (!A) return;
        var next = A.safeNext(${jsonForScript(safeNext)});
        var $ = function (id) { return document.getElementById(id); };
        var form = $('register-form'), banner = $('register-banner'), success = $('register-success-view');
        var name = $('register-display-name'), email = $('register-email'), pass = $('register-password'), terms = $('reg-terms');
        var nameHint = $('register-name-hint'), emailHint = $('register-email-hint'), passHint = $('register-password-hint'), termsHint = $('reg-terms-hint');
        var nameIcon = $('reg-name-valid-icon'), emailIcon = $('reg-email-valid-icon');
        var toggleBtn = $('reg-toggle-pwd'), genBtn = $('reg-gen-pwd');
        var ui = {
          btn: $('register-submit'), text: $('reg-btn-text'), icon: $('reg-btn-icon'),
          spinner: $('reg-btn-spinner'), status: $('register-status'),
          idleLabel: 'Créer mon compte', busyLabel: 'Création en cours…'
        };
        var busy = false, done = false;

        A.bindPasswordToggle(pass, toggleBtn, $('reg-icon-show'), $('reg-icon-hide'), $('reg-toggle-text'));

        function validName(v) { return (v || '').trim().length >= 2; }
        var NAME_MSG = 'Le nom doit comporter au moins 2 caractères.';
        var EMAIL_MSG = 'Format attendu\\u00a0: exemple@domaine.com';
        var PWD_MSG = 'Le mot de passe doit comporter au moins 8 caractères.';

        // ── Jauge + checklist. Seule la longueur minimale bloque la soumission :
        // les autres critères sont des conseils (la politique réelle est côté serveur).
        var segs = [1, 2, 3, 4].map(function (i) { return $('reg-str-' + i); });
        var strengthLabel = $('reg-strength-label');
        var items = ['len', 'long', 'case', 'mix'].map(function (k) { return $('chk-' + k); });
        var COLORS = ['', 'var(--color-error)', 'var(--color-warning, orange)', 'var(--color-primary)', 'var(--color-success)'];
        var LABELS = ['saisissez un mot de passe', 'faible', 'correcte', 'robuste', 'maximale'];

        function setItem(el, on) {
          el.classList.toggle('satisfied', on);
          var dot = el.querySelector('.check-dot'), st = el.querySelector('[data-state]');
          dot.textContent = on ? '\\u2713' : '';
          dot.style.backgroundColor = on ? 'var(--color-success)' : '';
          st.textContent = on ? ' — satisfait' : ' — non satisfait';
        }

        function updateStrength(v) {
          var tests = [
            v.length >= 8,
            v.length >= 12,
            /[a-z]/.test(v) && /[A-Z]/.test(v),
            /[0-9]/.test(v) || /[^A-Za-z0-9]/.test(v)
          ];
          items.forEach(function (el, i) { setItem(el, tests[i]); });
          var classes = (tests[2] ? 1 : 0) + (tests[3] ? 1 : 0);
          var score = 0;
          if (v) {
            if (v.length < 8) score = 1;
            else if (v.length >= 16 || (v.length >= 12 && classes === 2)) score = 4;
            else if (v.length >= 12 || classes === 2) score = 3;
            else score = 2;
          }
          segs.forEach(function (s, i) { s.style.backgroundColor = i < score ? COLORS[score] : ''; });
          strengthLabel.textContent = 'Force\\u00a0: ' + LABELS[score];
          return { ok: v.length >= 8 };
        }

        pass.addEventListener('input', function () {
          updateStrength(this.value);
          A.setFieldState(pass, null, passHint, 'clear'); A.hideBanner(banner);
        });
        pass.addEventListener('blur', function () {
          if (this.value && !updateStrength(this.value).ok) A.setFieldState(pass, null, passHint, 'error', PWD_MSG);
        });

        name.addEventListener('blur', function () {
          if (!this.value.trim()) return;
          var ok = validName(this.value);
          A.setFieldState(name, nameIcon, nameHint, ok ? 'ok' : 'error', ok ? '' : NAME_MSG);
        });
        name.addEventListener('input', function () {
          A.setFieldState(name, nameIcon, nameHint, 'clear'); A.hideBanner(banner);
        });

        email.addEventListener('blur', function () {
          if (!this.value.trim()) return;
          var ok = A.isEmail(this.value);
          A.setFieldState(email, emailIcon, emailHint, ok ? 'ok' : 'error', ok ? 'Adresse e-mail valide' : EMAIL_MSG);
        });
        email.addEventListener('input', function () {
          A.setFieldState(email, emailIcon, emailHint, 'clear'); A.hideBanner(banner);
        });

        terms.addEventListener('change', function () {
          if (this.checked) { terms.removeAttribute('aria-invalid'); A.setHint(termsHint, 'clear'); }
        });

        // ── Générateur : CSPRNG (crypto.getRandomValues), tirage sans biais.
        if (genBtn) {
          if (!(window.crypto && window.crypto.getRandomValues)) {
            genBtn.hidden = true;
          } else {
            var randInt = function (n) {
              var max = Math.floor(4294967296 / n) * n, a = new Uint32Array(1);
              do { window.crypto.getRandomValues(a); } while (a[0] >= max);
              return a[0] % n;
            };
            genBtn.addEventListener('click', function () {
              var sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%^&*-_+=?'];
              var all = sets.join(''), out = [], i, j, t;
              sets.forEach(function (s) { out.push(s.charAt(randInt(s.length))); });
              while (out.length < 16) out.push(all.charAt(randInt(all.length)));
              for (i = out.length - 1; i > 0; i--) { j = randInt(i + 1); t = out[i]; out[i] = out[j]; out[j] = t; }
              pass.value = out.join('');
              if (pass.type === 'password') toggleBtn.click(); // le mot de passe doit pouvoir être relu/enregistré
              updateStrength(pass.value);
              A.setFieldState(pass, null, passHint, 'ok', 'Mot de passe généré et affiché. Enregistrez-le dans votre gestionnaire de mots de passe.');
              pass.focus();
            });
          }
        }

        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          if (busy || done) return;

          var nameOk = validName(name.value);
          var emailOk = A.isEmail(email.value);
          var pwdOk = updateStrength(pass.value).ok;
          var termsOk = terms.checked;

          A.setFieldState(name, nameIcon, nameHint, nameOk ? 'ok' : 'error', nameOk ? '' : NAME_MSG);
          A.setFieldState(email, emailIcon, emailHint, emailOk ? 'ok' : 'error', emailOk ? 'Adresse e-mail valide' : EMAIL_MSG);
          if (!pwdOk) A.setFieldState(pass, null, passHint, 'error', PWD_MSG);
          if (!termsOk) { terms.setAttribute('aria-invalid', 'true'); A.setHint(termsHint, 'error', 'Veuillez accepter les conditions pour continuer.'); }

          if (!nameOk || !emailOk || !pwdOk || !termsOk) {
            A.showBanner(banner, 'Corrigez les champs signalés pour continuer.', 'error');
            (!nameOk ? name : !emailOk ? email : !pwdOk ? pass : terms).focus();
            return;
          }

          busy = true; A.hideBanner(banner); A.setBusy(ui, true);
          try {
            var r = await A.postJson('/api/auth/register', {
              email: email.value.trim(), password: pass.value, displayName: name.value.trim()
            });
            if (r.res.ok) {
              done = true;
              pass.value = ''; // on ne garde pas le mot de passe dans le DOM
              form.classList.add('hidden');
              success.classList.remove('hidden');
              $('register-success-title').focus();
            } else if (r.res.status === 409) {
              A.showBanner(banner, 'Un compte existe déjà avec cette adresse.', 'warning',
                'Se connecter', '/login?next=' + encodeURIComponent(next));
              email.focus();
            } else {
              A.showBanner(banner, A.errorMessage(r, 'Erreur lors de la création du compte. Réessayez.'), 'error');
            }
          } catch (ex) {
            A.showBanner(banner, A.networkMessage(ex), 'error');
          } finally {
            if (!done) { busy = false; A.setBusy(ui, false); }
          }
        });
      })();
    </script>`;

  return authShell("Inscription", activeMode, sharedStyles, formHtml);
}
