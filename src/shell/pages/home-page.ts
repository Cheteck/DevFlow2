/**
 * @shell/pages — Shell Social & Workspace Home Page SSR
 */

import { escapeHtml } from "@mosaix/support";
import type { ThemeMode } from "@mosaix/contracts";
import type { UserProfile } from "../profiles.js";
import type { FeedPost } from "../feed-store.js";
import {
  renderPrimarySidebar,
  renderSecondarySidebar,
  renderMobileDrawer,
  renderUserSwitcherWidget,
  renderHeaderSearchAndDevControls,
  renderShellToastContainer,
  renderShellConfirmModal,
} from "../renderer.js";
import { renderHeadBlock } from "../ssr-engine.js";
import { renderThemeStyleTag } from "../theme/theme-bridge.js";
import { getShellClientScripts } from "../client/shell-client-scripts.js";

export interface HomePageOptions {
  activeMode: ThemeMode;
  sharedStyles: string;
  currentUser: UserProfile;
  currentSpace: string | null;
  feedPosts: FeedPost[];
  widgetsHtml: string;
  requestUrl?: string;
}

export function renderHomePage(opts: HomePageOptions): string {
  const {
    activeMode,
    sharedStyles,
    currentUser,
    currentSpace,
    feedPosts,
    widgetsHtml,
    requestUrl,
  } = opts;

  return `<!DOCTYPE html>
<html class="${activeMode === 'dark' ? 'dark' : activeMode === 'high-contrast' ? 'high-contrast' : ''}" lang="fr" data-theme-mode="${activeMode}">
${renderHeadBlock("Midnight Pulse", activeMode, renderThemeStyleTag(activeMode), sharedStyles)}
  ${getShellClientScripts()}
</head>
<body class="bg-background text-on-surface min-h-screen font-sans antialiased selection:bg-primary/30 selection:text-primary">

  <div class="flex min-h-screen">

    <!-- 1. PRIMARY SIDEBAR (RBAC FILTERED) -->
    ${renderPrimarySidebar(currentUser, "/", currentSpace)}

    <!-- 2. SECONDARY CONTEXTUAL SIDEBAR (PERMISSION FILTERED) -->
    ${renderSecondarySidebar(currentUser, "shell_home", requestUrl || "/", currentSpace)}

    <!-- MOBILE NAVIGATION DRAWER -->
    ${renderMobileDrawer(currentUser, "/", activeMode)}

    <!-- 3. MAIN CONTENT CONTAINER -->
    <div class="main-workspace flex-1 flex flex-col min-w-0 md:ml-[72px] lg:ml-[336px]">
      
      <!-- TOP NAVIGATION BAR WITH USER SWITCHER -->
      <header class="h-[72px] sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 px-4 sm:px-6 flex items-center justify-between gap-4">
        
        <!-- Left Title / Context -->
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onclick="toggleMobileDrawer()" class="md:hidden p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Menu Principal">
            <span class="material-symbols-outlined text-base">menu</span>
          </button>

          <button onclick="toggleSecondarySidebar()" class="hidden lg:flex p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Masquer/Afficher le panneau latéral">
            <span class="material-symbols-outlined text-base">menu_open</span>
          </button>

          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">Réseau Décentralisé Actif</span>
            </div>
            <h1 class="font-bold text-sm sm:text-base text-on-surface truncate">Flux & Activités MosaiX</h1>
          </div>
        </div>

        <!-- Right Controls & User Profile -->
        <div class="flex items-center gap-3 shrink-0">
          ${renderHeaderSearchAndDevControls()}

          <!-- Live Theme Customizer Trigger Button -->
          <button onclick="toggleThemeCustomizerDrawer()" class="p-2 rounded-xl bg-surface-container-low border border-primary/30 hover:border-primary/60 transition text-primary hover:bg-surface-variant/40 flex items-center gap-1.5 cursor-pointer shadow-sm" title="Ouvrir l'Éditeur de Thème & Layout Live">
            <span class="material-symbols-outlined text-base animate-spin-slow">palette</span>
            <span class="text-xs font-bold hidden sm:inline" id="live-editor-btn-label">Éditeur Visuel</span>
          </button>

          <!-- Dynamic Language Selector -->
          <div class="hidden lg:flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs" id="mosaix-lang-selector">
            <button onclick="setLocale('fr')" id="lang-btn-fr" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">FR</button>
            <button onclick="setLocale('en')" id="lang-btn-en" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">EN</button>
            <button onclick="setLocale('ar')" id="lang-btn-ar" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">AR</button>
          </div>

          <div class="hidden lg:block h-6 w-px bg-outline-variant/30"></div>

          <!-- Dynamic Theme Toggle -->
          <div class="hidden lg:flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs">
            <button onclick="setTheme('light')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'light' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-variant/30'}">Light</button>
            <button onclick="setTheme('dark')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'dark' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-variant/30'}">Dark</button>
            <button onclick="setTheme('high-contrast')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'high-contrast' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-variant/30'}">Contrast</button>
          </div>

          <div class="hidden lg:block h-6 w-px bg-outline-variant/30"></div>

          <!-- USER SWITCHER WIDGET -->
          ${renderUserSwitcherWidget(currentUser, currentSpace)}
        </div>

      </header>

      <!-- MAIN SCROLLABLE DASHBOARD -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6">

        <!-- LEFT & CENTER FEED COLUMNS (SPAN 2) -->
        <div class="xl:col-span-2 space-y-6">

          <!-- ACTIVE SPACE NOTICE -->
          ${
            currentSpace
              ? `
          <div class="glass-card rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-secondary bg-surface-container-high/40 animate-fade-in">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-secondary text-2xl">workspaces</span>
              <div>
                <p class="text-xs font-bold text-on-surface">Espace Actif : <span class="text-secondary">${escapeHtml(currentSpace)}</span></p>
                <p class="text-[11px] text-on-surface-variant">Toutes les contributions et données sont restreintes au contexte de cet espace.</p>
              </div>
            </div>
            <button onclick="switchActiveSpace(null)" class="px-3 py-1.5 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/40 text-xs font-bold text-on-surface transition cursor-pointer">
              Quitter l'espace
            </button>
          </div>
          `
              : ""
          }

          <!-- REAL-TIME SOLARA FEED COMPOSER -->
          <div class="glass-card rounded-2xl p-5 space-y-4 border border-outline-variant/20 shadow-xl bg-surface-container-high/30">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
                ${currentUser.avatar}
              </div>
              <div class="flex-1">
                <h2 class="font-bold text-sm text-on-surface flex items-center gap-2" id="shell-composer-title">
                  <span>Partager avec la communauté</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-surface-variant/50 text-on-surface-variant font-medium">Solara Feed v2.4</span>
                </h2>
                <p class="text-[11px] text-on-surface-variant">Publiez des idées, propositions citoyennes ou annonces d'événements</p>
              </div>
            </div>

            <div class="relative">
              <textarea id="composer-text" rows="3" placeholder="Quoi de neuf sur la fédération MosaiX aujourd'hui ?" class="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-xl p-3 text-xs text-on-surface focus:outline-none focus:border-primary transition resize-none placeholder:text-on-surface-variant/50"></textarea>
            </div>

            <div class="flex items-center justify-between pt-1">
              <div class="flex items-center gap-2 text-on-surface-variant text-xs">
                <button class="p-2 rounded-lg hover:bg-surface-variant/40 transition flex items-center gap-1.5 cursor-pointer" title="Joindre une photo">
                  <span class="material-symbols-outlined text-base">image</span>
                  <span class="text-[11px] hidden sm:inline">Média</span>
                </button>
                <button class="p-2 rounded-lg hover:bg-surface-variant/40 transition flex items-center gap-1.5 cursor-pointer" title="Créer un scrutin Imperia">
                  <span class="material-symbols-outlined text-base text-indigo-400">how_to_vote</span>
                  <span class="text-[11px] hidden sm:inline">Scrutin</span>
                </button>
                <button class="p-2 rounded-lg hover:bg-surface-variant/40 transition flex items-center gap-1.5 cursor-pointer" title="Publier un article Beam">
                  <span class="material-symbols-outlined text-base text-emerald-400">chat_bubble</span>
                  <span class="text-[11px] hidden sm:inline">Message</span>
                </button>
              </div>

              <button onclick="publishPost()" class="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-primary/20 cursor-pointer">
                <span class="material-symbols-outlined text-sm">send</span>
                <span id="publish-btn-text">Publier sur Solara</span>
              </button>
            </div>
          </div>

          <!-- ACTIVE EXPERIENCE CONTRACTS WIDGETS -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-base">dashboard_customize</span>
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Widgets & Blocs d'Expérience</h3>
              </div>
              <span class="text-[10px] text-on-surface-variant font-medium">Slot: shell.home.widgets</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              ${widgetsHtml}
            </div>
          </div>

          <!-- FEED STREAM -->
          <div class="space-y-4" id="feed-stream-container">
            ${feedPosts
              .map(
                (post) => `
              <div class="glass-card rounded-2xl p-5 space-y-4 border border-outline-variant/15 hover:border-outline-variant/30 transition shadow-md bg-surface-container-high/20" id="${post.id}">
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-surface-variant/50 border border-outline-variant/30 flex items-center justify-center text-lg">
                      ${post.authorAvatar}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-on-surface">${escapeHtml(post.author)}</span>
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-surface-variant/60 text-on-surface-variant">${escapeHtml(post.authorRole)}</span>
                      </div>
                      <span class="text-[10px] text-on-surface-variant/60">${escapeHtml(post.timestamp)} &bull; Source : <strong class="text-primary font-medium">${escapeHtml(post.bacSource)}</strong></span>
                    </div>
                  </div>

                  <button class="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-variant/30 transition cursor-pointer">
                    <span class="material-symbols-outlined text-sm">more_horiz</span>
                  </button>
                </div>

                <div class="text-xs text-on-surface leading-relaxed whitespace-pre-line pl-1">
                  ${escapeHtml(post.content)}
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs text-on-surface-variant">
                  <button onclick="likePost('${post.id}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-variant/30 hover:text-rose-400 transition cursor-pointer">
                    <span class="material-symbols-outlined text-sm">favorite</span>
                    <span class="text-[11px] font-semibold" id="likes-${post.id}">${post.likes}</span>
                  </button>

                  <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-variant/30 hover:text-primary transition cursor-pointer">
                    <span class="material-symbols-outlined text-sm">chat_bubble_outline</span>
                    <span class="text-[11px] font-semibold">Commenter</span>
                  </button>

                  <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-variant/30 hover:text-emerald-400 transition cursor-pointer">
                    <span class="material-symbols-outlined text-sm">share</span>
                    <span class="text-[11px] font-semibold">Partager</span>
                  </button>
                </div>
              </div>
            `
              )
              .join("")}
          </div>

        </div>

        <!-- RIGHT SIDEBAR (TRENDS, QUICK ACTIONS, METRICS) -->
        <aside class="space-y-6">

          <!-- FEDERATION HEALTH METRICS -->
          <div class="glass-card rounded-2xl p-5 space-y-4 border border-outline-variant/20 bg-surface-container-high/30">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-xs text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-emerald-400 text-base">query_stats</span>
                Santé du Cluster MosaiX
              </h3>
              <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">99.98%</span>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <div class="flex justify-between text-[11px] mb-1">
                  <span class="text-on-surface-variant">Modules BAC Actifs</span>
                  <span class="font-bold text-on-surface">8 / 8 En Ligne</span>
                </div>
                <div class="w-full h-1.5 bg-surface-variant/40 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-500 rounded-full w-full"></div>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-[11px] mb-1">
                  <span class="text-on-surface-variant">Latence Inter-Modules</span>
                  <span class="font-bold text-on-surface">1.2 ms (In-Memory)</span>
                </div>
                <div class="w-full h-1.5 bg-surface-variant/40 rounded-full overflow-hidden">
                  <div class="h-full bg-indigo-500 rounded-full w-1/4"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- TRENDING TOPICS -->
          <div class="glass-card rounded-2xl p-5 space-y-3 border border-outline-variant/20 bg-surface-container-high/30">
            <h3 class="font-bold text-xs text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base">trending_up</span>
              Tendances & Débats
            </h3>

            <div class="space-y-2.5">
              <div class="flex items-start justify-between group cursor-pointer hover:bg-surface-variant/20 p-2 -mx-2 rounded-lg transition-colors">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span> Gouvernance
                  </span>
                  <span class="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">#ImperiaVote</span>
                  <span class="text-[10px] text-on-surface-variant/70">12.5k pulses</span>
                </div>
                <span class="material-symbols-outlined text-on-surface-variant/50 text-sm group-hover:text-primary transition-colors">arrow_outward</span>
              </div>

              <div class="flex items-start justify-between group cursor-pointer hover:bg-surface-variant/20 p-2 -mx-2 rounded-lg transition-colors">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Réseau
                  </span>
                  <span class="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">Solara ECHoS</span>
                  <span class="text-[10px] text-on-surface-variant/70">8.2k pulses</span>
                </div>
                <span class="material-symbols-outlined text-on-surface-variant/50 text-sm group-hover:text-primary transition-colors">arrow_outward</span>
              </div>
            </div>
          </div>

        </aside>

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

    function toggleThemeCustomizerDrawer() {
      const drawer = document.getElementById('theme-customizer-drawer');
      if (drawer) {
        drawer.classList.toggle('translate-x-full');
      }
    }

    async function publishPost() {
      const input = document.getElementById('composer-text');
      if (!input || !input.value.trim()) {
        showToast('Veuillez saisir un message pour publier.', 'warning');
        return;
      }
      try {
        const res = await fetch('/api/feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: input.value.trim() })
        });
        if (res.ok) {
          input.value = '';
          showToast('Publication partagée avec succès !', 'success');
          setTimeout(() => window.location.reload(), 500);
        } else {
          showToast('Impossible de publier le message.', 'error');
        }
      } catch (e) {
        showToast('Erreur réseau lors de la publication.', 'error');
      }
    }

    function likePost(postId) {
      const el = document.getElementById('likes-' + postId);
      if (el) {
        el.textContent = String(parseInt(el.textContent || '0', 10) + 1);
        showToast('Vous avez aimé cette publication.', 'success');
      }
    }
  </script>
</body>
</html>`;
}
