/**
 * @shell/pages — Public auth pages (login + registration waiting room).
 *
 * `/login` is a functional form wired to `POST /api/auth/login` (uniform
 * errors, strict rate-limit bucket, `__Host-` cookie set server-side).
 * `/register` is an explicit WAITING page (product decision: no fake
 * signup while real registration/AUTH-05 is not implemented) linking back
 * to login. `POST /api/auth/register` answers 501 as the machine-readable
 * contract — never a fabricated account.
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
${renderHeadBlock(title, activeMode, renderThemeStyleTag(activeMode), sharedStyles)}
  ${getShellClientScripts()}
</head>
<body class="bg-background text-on-surface min-h-screen font-sans antialiased">
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <a href="/commerce" class="flex items-center justify-center gap-2 mb-6 group">
        <span class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary via-indigo-500 to-secondary flex items-center justify-center text-xl">✨</span>
        <span class="font-bold text-on-surface group-hover:text-primary transition">MosaiX Platform</span>
      </a>
      ${cardHtml}
      <p class="text-center text-[11px] text-on-surface-variant/60 mt-4">
        <a href="/commerce" class="hover:text-on-surface transition">← Retour à la vitrine</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function renderLoginPage(opts: AuthPageOptions): string {
  const { activeMode, sharedStyles, safeNext } = opts;
  const card = `
      <div class="glass-card rounded-2xl p-6 space-y-5">
        <div>
          <h1 class="font-bold text-lg text-on-surface">Se connecter</h1>
          <p class="text-xs text-on-surface-variant mt-1">Accédez à votre fil, vos espaces et vos commandes.</p>
        </div>
        <form id="login-form" class="space-y-4" autocomplete="on">
          <div>
            <label for="login-email" class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Email</label>
            <input id="login-email" name="email" type="email" required autocomplete="username"
              class="w-full bg-surface-container border border-outline-variant/20 focus:border-primary/50 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none transition" />
          </div>
          <div>
            <label for="login-password" class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Mot de passe</label>
            <input id="login-password" name="password" type="password" required autocomplete="current-password"
              class="w-full bg-surface-container border border-outline-variant/20 focus:border-primary/50 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none transition" />
          </div>
          <p id="login-error" class="hidden text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2" role="alert"></p>
          <button type="submit" id="login-submit"
            class="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-sm font-bold transition disabled:opacity-50">
            Se connecter
          </button>
        </form>
        <p class="text-xs text-on-surface-variant text-center">
          Pas encore de compte ?
          <a href="/register?next=${encodeURIComponent(safeNext)}" class="text-primary font-semibold hover:underline">Voir comment s'inscrire</a>
        </p>
      </div>
      <script>
        (function() {
          var next = ${JSON.stringify(safeNext)};
          var form = document.getElementById('login-form');
          var err = document.getElementById('login-error');
          var btn = document.getElementById('login-submit');
          form.addEventListener('submit', async function(e) {
            e.preventDefault();
            err.classList.add('hidden');
            btn.disabled = true;
            try {
              var res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: document.getElementById('login-email').value,
                  password: document.getElementById('login-password').value
                })
              });
              if (res.ok) {
                window.location.href = next;
              } else {
                err.textContent = 'Identifiants invalides. Vérifiez votre email et mot de passe.';
                err.classList.remove('hidden');
              }
            } catch (ex) {
              err.textContent = 'Service momentanément indisponible. Réessayez dans un instant.';
              err.classList.remove('hidden');
            } finally {
              btn.disabled = false;
            }
          });
        })();
      </script>`;
  return authShell("Connexion", activeMode, sharedStyles, card);
}

export function renderRegisterPage(opts: AuthPageOptions): string {
  const { activeMode, sharedStyles } = opts;
  const card = `
      <div class="glass-card rounded-2xl p-6 space-y-5">
        <div>
          <h1 class="font-bold text-lg text-on-surface">Créer un compte</h1>
          <p class="text-xs text-on-surface-variant mt-1">L'inscription publique n'est pas encore ouverte : les comptes sont créés par un administrateur pendant cette phase.</p>
        </div>
        <div class="text-xs text-on-surface-variant bg-surface-container/60 border border-outline-variant/15 rounded-xl px-4 py-3 leading-relaxed">
          Vous avez déjà un compte ? Connectez-vous pour retrouver votre fil, vos espaces et vos commandes.
          L'ouverture des inscriptions sera annoncée ici même.
        </div>
        <a href="/login?next=${encodeURIComponent(opts.safeNext)}"
          class="block text-center w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-sm font-bold transition">
          Se connecter
        </a>
      </div>`;
  return authShell("Inscription", activeMode, sharedStyles, card);
}
