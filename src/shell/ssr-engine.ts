/**
 * @mosaix/shell — Accelerated SSR Engine with LRU Fragment Caching, ARIA WCAG 2.1 AA Compliance & Mobile Navigation Drawer
 */

import { ssrFragmentCache } from "./ssr-cache.js";
import { escapeHtml } from "@mosaix/support";
import { getTailwindThemeColors } from "./theme/theme-bridge.js";

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

function toBridgeMode(mode: string): "light" | "dark" | "high-contrast" {
  return mode === "dark" || mode === "high-contrast" ? mode : "light";
}

/**
 * Renders HTML head block with LRU fragment caching.
 */
export function renderHeadBlock(
  pageTitle: string,
  activeThemeMode: string,
  themeStyleTagHtml: string,
  sharedStylesHtml: string,
): string {
  const cacheKey = `head:${pageTitle}:${activeThemeMode}`;
  return ssrFragmentCache.getOrCompute(
    cacheKey,
    () => `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
      <title>${escapeHtml(pageTitle)} — MosaiX Platform</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg">
      <link rel="manifest" href="/site.webmanifest">
      ${themeStyleTagHtml}
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet">
      <script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              colors: ${JSON.stringify(getTailwindThemeColors(toBridgeMode(activeThemeMode)), null, 14)}
            }
          }
        }
      </script>
      <style>
        ${sharedStylesHtml}
        .glass-card {
          background-color: ${activeThemeMode === "light" ? "rgba(255, 255, 255, 0.7)" : "rgba(30, 41, 59, 0.4)"};
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid ${activeThemeMode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(71, 85, 105, 0.2)"};
          box-shadow: 0 4px 30px rgba(0, 0, 0, ${activeThemeMode === "light" ? "0.05" : "0.1"});
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
      </style>
    </head>
  `,
    60_000,
  );
}

/**
 * Renders Mobile Navigation Drawer component for small screens (<640px)
 */
export function renderMobileDrawer(navigationItemsHtml: string): string {
  return `
    <!-- Mobile Drawer Overlay & Slide-over Navigation (WCAG 2.1 AA Compliant) -->
    <div id="mobile-drawer-container" class="fixed inset-0 z-50 pointer-events-none hidden" aria-hidden="true">
      <div id="mobile-drawer-backdrop" onclick="toggleMobileDrawer(false)" class="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 pointer-events-auto transition-opacity duration-300"></div>
      <aside id="mobile-drawer" class="absolute top-0 bottom-0 left-0 w-80 max-w-[85vw] bg-surface-container border-r border-outline-variant/30 shadow-2xl transform -translate-x-full pointer-events-auto flex flex-col justify-between p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Menu de navigation mobile">
        <div class="space-y-6">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
            <div class="flex items-center gap-3">
              <span class="text-2xl">🔮</span>
              <span class="font-bold text-on-surface text-lg tracking-tight">MosaiX Mobile</span>
            </div>
            <button onclick="toggleMobileDrawer(false)" class="p-2 rounded-xl hover:bg-surface-variant/40 text-on-surface-variant hover:text-on-surface transition" aria-label="Fermer le menu mobile">
              ✕
            </button>
          </div>
          
          <nav aria-label="Navigation principale mobile" class="space-y-2">
            ${navigationItemsHtml}
          </nav>
        </div>

        <div class="pt-6 border-t border-outline-variant/20 space-y-3">
          <div class="text-xs text-on-surface-variant flex items-center justify-between">
            <span>Réseau MosaiX v0.1.0</span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">En ligne</span>
          </div>
        </div>
      </aside>
    </div>

    <script>
      function toggleMobileDrawer(open) {
        const container = document.getElementById('mobile-drawer-container');
        const backdrop = document.getElementById('mobile-drawer-backdrop');
        const drawer = document.getElementById('mobile-drawer');
        if (!container || !backdrop || !drawer) return;

        if (open) {
          container.classList.remove('hidden');
          container.setAttribute('aria-hidden', 'false');
          setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            drawer.classList.remove('-translate-x-full');
          }, 10);
        } else {
          backdrop.classList.add('opacity-0');
          drawer.classList.add('-translate-x-full');
          setTimeout(() => {
            container.classList.add('hidden');
            container.setAttribute('aria-hidden', 'true');
          }, 300);
        }
      }
    </script>
  `;
}
