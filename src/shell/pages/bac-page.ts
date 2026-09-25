/**
 * @shell/pages — BAC Workspace Page SSR
 */

import { escapeHtml } from "@mosaix/support";
import type { ThemeMode } from "@mosaix/contracts";
import type { UserProfile } from "../profiles.js";
import {
  renderPrimarySidebar,
  renderSecondarySidebar,
  renderMobileDrawer,
  renderUserSwitcherWidget,
  renderHeaderSearchAndDevControls,
  renderShellToastContainer,
  renderShellConfirmModal,
} from "../renderer.js";
import { getShellClientScripts } from "../client/shell-client-scripts.js";

export interface BacPageOptions {
  activeMode: ThemeMode;
  sharedStyles: string;
  themeStyle: string;
  matchedApp: {
    id: string;
    name: string;
    route: string;
    category: string;
  };
  currentUser: UserProfile;
  currentSpace: string | null;
  renderedContent: string;
  contributionsCount: number;
  requestUrl?: string;
}

export function renderBacPage(opts: BacPageOptions): string {
  const {
    activeMode,
    sharedStyles,
    themeStyle,
    matchedApp,
    currentUser,
    currentSpace,
    renderedContent,
    contributionsCount,
    requestUrl,
  } = opts;

  return `<!DOCTYPE html>
<html class="${activeMode === 'dark' ? 'dark' : activeMode === 'high-contrast' ? 'high-contrast' : ''}" lang="fr" data-theme-mode="${activeMode}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(matchedApp.name)} — MosaiX Experience</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
  
  <style>
    ${sharedStyles}
    ${themeStyle}
  </style>

  ${getShellClientScripts()}
</head>
<body class="bg-background text-on-surface min-h-screen font-sans antialiased">
  
  <div class="flex min-h-screen">
    
    <!-- PRIMARY SIDEBAR (RBAC FILTERED) -->
    ${renderPrimarySidebar(currentUser, matchedApp.route, currentSpace)}

    <!-- SECONDARY CONTEXTUAL SIDEBAR (PERMISSION FILTERED) -->
    ${renderSecondarySidebar(currentUser, matchedApp.id, requestUrl || matchedApp.route, currentSpace)}

    <!-- MOBILE NAVIGATION DRAWER -->
    ${renderMobileDrawer(currentUser, matchedApp.route, activeMode)}

    <!-- MAIN WORKSPACE AREA -->
    <div class="main-workspace flex-1 flex flex-col min-w-0 md:ml-[72px] lg:ml-[336px]">
      
      <!-- TOP BAR WITH USER SWITCHER -->
      <header class="h-[72px] sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 px-4 sm:px-6 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          <!-- Mobile Menu Trigger -->
          <button onclick="toggleMobileDrawer()" class="md:hidden p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Menu Principal">
            <span class="material-symbols-outlined text-base">menu</span>
          </button>

          <!-- Toggle sidebar button -->
          <button onclick="toggleSecondarySidebar()" class="hidden lg:flex p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Masquer/Afficher le panneau latéral">
            <span class="material-symbols-outlined text-base">menu_open</span>
          </button>
          <a href="/" class="p-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-all text-xs font-semibold shrink-0">
            &larr; <span class="hidden sm:inline">Accueil</span>
          </a>
          <h1 class="font-bold text-sm sm:text-base text-on-surface truncate">${escapeHtml(matchedApp.name)}</h1>
          <span class="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">${matchedApp.category}</span>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          ${renderHeaderSearchAndDevControls()}

          <!-- Dynamic Language Selector -->
          <div class="hidden lg:flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs" id="mosaix-lang-selector">
            <button onclick="setLocale('fr')" id="lang-btn-fr" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">FR</button>
            <button onclick="setLocale('en')" id="lang-btn-en" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">EN</button>
            <button onclick="setLocale('ar')" id="lang-btn-ar" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">AR</button>
          </div>

          <div class="hidden lg:block h-6 w-px bg-outline-variant/30"></div>

          <!-- Dynamic Theme Toggle -->
          <div class="hidden lg:flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs">
            <button onclick="setTheme('light')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'light' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Light</button>
            <button onclick="setTheme('dark')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'dark' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Dark</button>
            <button onclick="setTheme('high-contrast')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'high-contrast' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Contrast</button>
          </div>

          <div class="hidden lg:block h-6 w-px bg-outline-variant/30"></div>

          <!-- USER SWITCHER WIDGET -->
          ${renderUserSwitcherWidget(currentUser, currentSpace)}
        </div>
      </header>

      <!-- CONTENT AREA -->
      <main class="p-6 max-w-7xl w-full mx-auto space-y-6">
        <div class="glass-card rounded-2xl p-6 space-y-6">
          <div class="bac-content-section">
            ${renderedContent}
          </div>

          <div class="pt-4 border-t border-outline-variant/20 flex justify-between items-center text-xs text-on-surface-variant">
            <span>Contrats enregistrés : <strong class="text-on-surface">${contributionsCount} contributions</strong></span>
            <a href="/" class="text-primary hover:underline font-semibold">&larr; Retour au réseau MosaiX</a>
          </div>
        </div>
      </main>

    </div>
  </div>

  ${renderShellToastContainer()}
  ${renderShellConfirmModal()}

  <script>
    async function setTheme(mode) {
      document.documentElement.setAttribute('data-theme-mode', mode);
      try {
        await fetch('/api/theme?mode=' + mode, { method: 'POST' });
      } catch (e) {}
    }

    function toggleSecondarySidebar() {
      const isCollapsed = document.documentElement.classList.toggle('sidebar-collapsed');
      localStorage.setItem('mosaix_secondary_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    }

    function filterSecondarySidebar(query) {
      const q = (query || '').toLowerCase().trim();
      const clearBtn = document.getElementById('secondary-sidebar-filter-clear');
      if (clearBtn) {
        if (q) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      const container = document.getElementById('mosaix-slot-shell-sidebar-secondary');
      if (!container) return;
      const items = container.querySelectorAll('.sidebar-nav-item');
      let visibleCount = 0;
      items.forEach(item => {
        const text = (item.getAttribute('data-search') || item.textContent || '').toLowerCase();
        if (!q || text.includes(q)) {
          item.classList.remove('hidden');
          visibleCount++;
        } else {
          item.classList.add('hidden');
        }
      });
      const emptyMsg = document.getElementById('secondary-sidebar-empty-state');
      if (emptyMsg) {
        if (visibleCount === 0 && q) {
          emptyMsg.classList.remove('hidden');
        } else {
          emptyMsg.classList.add('hidden');
        }
      }
    }

    function clearSecondarySidebarFilter() {
      const input = document.getElementById('secondary-sidebar-filter');
      if (input) {
        input.value = '';
        filterSecondarySidebar('');
        input.focus();
      }
    }
  </script>
</body>
</html>`;
}
