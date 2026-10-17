/**
 * @mosaix/shell — SSR head fragment + Mobile Navigation Drawer
 *
 * Trust contracts (ne pas élargir sans ADR) :
 * - `pageTitle` : texte NON fiable → toujours inséré via `escapeHtml()`.
 * - `themeStyleTagHtml`, `sharedStylesHtml`, `navigationItemsHtml` :
 *   fragments HTML DE CONFIANCE produits exclusivement par des renderers
 *   internes (`theme-bridge.renderThemeStyleTag()`, `renderer.PRIMARY_RAIL_*`,
 *   navigation filtrée RBAC). Ne JAMAIS y concaténer de données utilisateur
 *   brutes. Les passer tels quels (les échapper afficherait les balises).
 * - Couleurs Tailwind sérialisées en JSON puis neutralisées (`<` → `\u003c`)
 *   pour empêcher toute sortie du contexte `<script>`.
 *
 * Cache : `FragmentCache.getOrCompute(key, fn, ttlMs)` — le 3e argument est
 * un TTL en millisecondes. La clé couvre TOUTES les entrées dynamiques
 * (titre, mode pont, theme id, hash des deux fragments de styles). Sans cela,
 * deux pages partageant titre+mode mais pas styles recevraient un `<head>`
 * obsolète (P1). La clé est sérialisée en JSON (pas de concaténation à
 * séparateur ambigu) ; les segments libres sont hachés (FNV-1a 32 bits,
 * non crypto — suffisante ici : ≤500 entrées, TTL 60 s, fragments
 * internes non adversariaux ; probabilité de collision accidentelle
 * négligeable). Condition d'isolation : tout contenu variant par tenant /
 * contexte DOIT transiter par `themeStyleTagHtml` ou `sharedStylesHtml`
 * (couverts par hash) — jamais par un global non cléf (les couleurs Tailwind
 * et le CSS `.glass-card` dérivent uniquement de `bridgeMode` + theme id,
 * eux-mêmes cléf).
 *
 * BREAKING (2026-10-13) : `renderHeadBlock()` retourne désormais le contenu
 * INTÉRIEUR du `<head>` (sans balises `<head>` englobantes) afin que les
 * appelants composent un document valide :
 * `<head>${renderHeadBlock(...)}${getShellClientScripts()}</head>`.
 * L'ancien retour `<head>…</head>` produisait des `<head>` imbriqués
 * (maintenance-gate) ou un `</head>` orphelin (home/auth).
 */

import { ssrFragmentCache } from "./ssr-cache.js";
import { escapeHtml } from "@mosaix/support";
import {
  getActiveThemeId,
  getTailwindThemeColors,
} from "./theme/theme-bridge.js";

// Single canonical escapeHtml lives in @mosaix/support (A-03).
// This module re-exports it so existing deep imports keep working.
export { escapeHtml };

export interface RenderShellOptions {
  pageTitle: string;
  activeThemeMode: string;
  themeStyleTagHtml: string;
  sharedStylesHtml: string;
  topHeaderHtml: string;
  navigationSidebarHtml: string;
  secondarySidebarHtml?: string;
  mainContentHtml: string;
  socialFeedHtml?: string;
  footerHtml?: string;
}

/** Fragments HTML de confiance — voir l'en-tête du module. */
export type TrustedHeadHtml = string;

function toBridgeMode(mode: string): "light" | "dark" | "high-contrast" {
  return mode === "dark" || mode === "high-contrast" ? mode : "light";
}

/** FNV-1a 32 bits — empreinte courte non crypto, suffisante pour une clé. */
function hashFragment(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Sérialisation JSON sûre en contexte `<script>` : neutralise `</script>`. */
function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Renders the INNER content of the HTML head block with LRU fragment caching.
 * Wrap with `<head>…</head>` at the call site.
 */
export function renderHeadBlock(
  pageTitle: string,
  activeThemeMode: string,
  themeStyleTagHtml: TrustedHeadHtml,
  sharedStylesHtml: TrustedHeadHtml,
): string {
  const bridgeMode = toBridgeMode(activeThemeMode);
  const themeId = getActiveThemeId();
  const cacheKey = JSON.stringify([
    "head",
    pageTitle,
    bridgeMode,
    themeId,
    hashFragment(themeStyleTagHtml),
    hashFragment(sharedStylesHtml),
  ]);

  const HEAD_TTL_MS = 60_000;
  return ssrFragmentCache.getOrCompute(
    cacheKey,
    () => `      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(pageTitle)} — MosaiX Platform</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg">
      <link rel="manifest" href="/site.webmanifest">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      ${themeStyleTagHtml}
      <!-- PROD NOTE : le CDN Tailwind JIT ci-dessous est un choix dev. Pour la
           production, compiler Tailwind au build (CSS versionné + cache
           navigateur) et durcir la CSP (pas de CDN JS, pas de onclick inline,
           scripts avec nonce). Mesurer FCP/LCP avant/après sur pages réelles. -->
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet">
      <script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              colors: ${safeJsonForScript(getTailwindThemeColors(bridgeMode))}
            }
          }
        }
      </script>
      <style>
        ${sharedStylesHtml}
        .glass-card {
          background-color: ${bridgeMode === "light" ? "rgba(255, 255, 255, 0.7)" : "rgba(30, 41, 59, 0.4)"};
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid ${bridgeMode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(71, 85, 105, 0.2)"};
          box-shadow: 0 4px 30px rgba(0, 0, 0, ${bridgeMode === "light" ? "0.05" : "0.1"});
        }
        .glass-hover-glow:hover {
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.15);
          border-color: rgba(139, 92, 246, 0.3);
          transition: all 0.3s ease;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Mobile Navigation Drawer & Bottom Sheet Styles */
        #mobile-drawer-backdrop {
          transition: opacity 0.25s ease-in-out;
        }
        #mobile-drawer {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          #mobile-drawer-backdrop, #mobile-drawer { transition: none; }
        }
      </style>
  `,
    HEAD_TTL_MS,
  );
}

export interface MobileDrawerOptions {
  /** Libellé de version affiché dans le pied du tiroir (texte, échappé). */
  version?: string;
  /** `false` → pastille "Hors ligne". Défaut `true`. */
  online?: boolean;
}

/**
 * Renders an accessible Mobile Navigation Drawer (slide-over, modal dialog).
 *
 * Accessibilité (WCAG 2.1 AA) : `role="dialog"` + `aria-modal`, focus déplacé
 * vers la fermeture à l'ouverture, confinement Tab, fermeture Échap et clic
 * fond, retour focus au déclencheur, fond `inert` + scroll verrouillé,
 * `prefers-reduced-motion` respecté, transitions protégées contre les
 * ouvertures/fermetures concurrentes (jeton de génération).
 *
 * `navigationItemsHtml` est un fragment DE CONFIANCE (navigation RBAC interne).
 *
 * Note : aucune page n'inclut encore ce tiroir (home/bac utilisent le
 * bottom-sheet de `renderer.ts`). Une page qui l'adopte doit ajouter à son
 * bouton déclencheur `data-drawer-trigger aria-expanded="false"
 * aria-controls="mobile-drawer-container"` — le script ci-dessous synchronise
 * alors `aria-expanded` automatiquement. Ne pas dupliquer les deux tiroirs
 * sur la même page (conflit d'`id` et de `toggleMobileDrawer` global).
 */
export function renderMobileDrawer(
  navigationItemsHtml: TrustedHeadHtml,
  opts: MobileDrawerOptions = {},
): string {
  const version = escapeHtml(opts.version ?? "Réseau MosaiX v0.1.0");
  const online = opts.online ?? true;

  return `
    <!-- Mobile Drawer Overlay & Slide-over Navigation -->
    <div id="mobile-drawer-container" class="fixed inset-0 z-50 pointer-events-none hidden" aria-hidden="true">
      <div id="mobile-drawer-backdrop" data-drawer-close class="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 pointer-events-auto transition-opacity duration-300"></div>
      <aside id="mobile-drawer" class="absolute top-0 bottom-0 left-0 w-80 max-w-[85vw] bg-surface-container border-r border-outline-variant/30 shadow-2xl transform -translate-x-full pointer-events-auto flex flex-col justify-between p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Menu de navigation mobile" tabindex="-1">
        <div class="space-y-6">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
            <div class="flex items-center gap-3">
              <span class="text-2xl" aria-hidden="true">🔮</span>
              <span class="font-bold text-on-surface text-lg tracking-tight">MosaiX Mobile</span>
            </div>
            <button id="mobile-drawer-close" data-drawer-close class="p-2 rounded-xl hover:bg-surface-variant/40 text-on-surface-variant hover:text-on-surface transition" aria-label="Fermer le menu mobile">
              ✕
            </button>
          </div>

          <nav aria-label="Navigation principale mobile" class="space-y-2">
            ${navigationItemsHtml}
          </nav>
        </div>

        <div class="pt-6 border-t border-outline-variant/20 space-y-3">
          <div class="text-xs text-on-surface-variant flex items-center justify-between">
            <span>${version}</span>
            ${
              online
                ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">En ligne</span>'
                : '<span class="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30 text-[10px] font-bold">Hors ligne</span>'
            }
          </div>
        </div>
      </aside>
    </div>

    <script>
      (function () {
        var OPEN_DELAY_MS = 10;
        var CLOSE_DELAY_MS = 300;
        var generation = 0;
        var lastTrigger = null;
        var keyHandler = null;
        var reduceMotion =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function elements() {
          return {
            container: document.getElementById("mobile-drawer-container"),
            backdrop: document.getElementById("mobile-drawer-backdrop"),
            drawer: document.getElementById("mobile-drawer"),
            closeBtn: document.getElementById("mobile-drawer-close"),
          };
        }

        function setTriggersExpanded(open) {
          var triggers = document.querySelectorAll("[data-drawer-trigger]");
          for (var i = 0; i < triggers.length; i += 1) {
            triggers[i].setAttribute("aria-expanded", open ? "true" : "false");
          }
        }

        function setBackgroundInert(inert) {
          var container = document.getElementById("mobile-drawer-container");
          var siblings = document.body ? document.body.children : [];
          for (var i = 0; i < siblings.length; i += 1) {
            var el = siblings[i];
            if (el === container || el.tagName === "SCRIPT") continue;
            if (inert) el.setAttribute("inert", "");
            else el.removeAttribute("inert");
          }
        }

        function focusables() {
          var drawer = document.getElementById("mobile-drawer");
          if (!drawer) return [];
          var nodes = drawer.querySelectorAll(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          return Array.prototype.filter.call(nodes, function (el) {
            return el.offsetParent !== null || el === document.activeElement;
          });
        }

        function trapTab(e) {
          if (e.key !== "Tab") return;
          var items = focusables();
          if (items.length === 0) {
            e.preventDefault();
            return;
          }
          var first = items[0];
          var last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }

        function openDrawer(trigger) {
          var parts = elements();
          if (!parts.container || !parts.backdrop || !parts.drawer) return;
          var myGen = ++generation;
          lastTrigger =
            trigger instanceof HTMLElement
              ? trigger
              : document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

          parts.container.classList.remove("hidden");
          parts.container.setAttribute("aria-hidden", "false");
          setBackgroundInert(true);
          setTriggersExpanded(true);
          document.body.style.overflow = "hidden";

          if (!keyHandler) {
            keyHandler = function (e) {
              if (e.key === "Escape") {
                e.preventDefault();
                window.toggleMobileDrawer(false);
              } else {
                trapTab(e);
              }
            };
            document.addEventListener("keydown", keyHandler);
          }

          var activate = function () {
            if (myGen !== generation) return;
            parts.backdrop.classList.remove("opacity-0");
            parts.drawer.classList.remove("-translate-x-full");
            var target = parts.closeBtn || parts.drawer;
            if (target && typeof target.focus === "function") target.focus();
          };
          if (reduceMotion) activate();
          else window.setTimeout(activate, OPEN_DELAY_MS);
        }

        function closeDrawer() {
          var parts = elements();
          if (!parts.container || !parts.backdrop || !parts.drawer) return;
          var myGen = ++generation;

          parts.backdrop.classList.add("opacity-0");
          parts.drawer.classList.add("-translate-x-full");
          setTriggersExpanded(false);

          var finish = function () {
            if (myGen !== generation) return;
            parts.container.classList.add("hidden");
            parts.container.setAttribute("aria-hidden", "true");
            setBackgroundInert(false);
            document.body.style.overflow = "";
            if (keyHandler) {
              document.removeEventListener("keydown", keyHandler);
              keyHandler = null;
            }
            if (lastTrigger && typeof lastTrigger.focus === "function") {
              lastTrigger.focus();
              lastTrigger = null;
            }
          };
          if (reduceMotion) finish();
          else window.setTimeout(finish, CLOSE_DELAY_MS);
        }

        function isOpen() {
          var container = document.getElementById("mobile-drawer-container");
          return !!container && !container.classList.contains("hidden");
        }

        window.toggleMobileDrawer = function (open, trigger) {
          var shouldOpen =
            typeof open === "boolean" ? open : !isOpen();
          if (shouldOpen) openDrawer(trigger || null);
          else closeDrawer();
        };

        var wired = elements();
        if (wired.backdrop) {
          wired.backdrop.addEventListener("click", function () {
            window.toggleMobileDrawer(false);
          });
        }
        var closers = document.querySelectorAll("[data-drawer-close]");
        for (var i = 0; i < closers.length; i += 1) {
          closers[i].addEventListener("click", function () {
            window.toggleMobileDrawer(false);
          });
        }
      })();
    </script>
  `;
}
