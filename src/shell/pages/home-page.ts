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
  renderMobileBottomNav,
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
<html class="${activeMode === "dark" ? "dark" : activeMode === "high-contrast" ? "high-contrast" : ""}" lang="fr" data-theme-mode="${activeMode}">
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
      
      <!-- TOP NAVIGATION BAR WITH USER SWITCHER (PRE-PRODUCTION GRADE) -->
      <header class="h-[68px] sticky top-0 z-40 bg-surface/85 backdrop-blur-2xl border-b border-outline-variant/15 px-4 sm:px-6 flex items-center justify-between gap-4 select-none">
        
        <!-- Left Title / Context / Breadcrumb -->
        <div class="flex items-center gap-3 min-w-0">
          <button onclick="toggleMobileDrawer()" class="md:hidden p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Menu Principal">
            <span class="material-symbols-outlined text-lg">menu</span>
          </button>

          <button onclick="toggleSecondarySidebar()" class="hidden lg:flex p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Masquer / Afficher le panneau latéral">
            <span class="material-symbols-outlined text-lg">menu_open</span>
          </button>

          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2 text-[10px] text-on-surface-variant/70 font-medium">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="font-bold text-emerald-400 uppercase tracking-wider">Cluster Pré-Production</span>
              <span class="text-outline-variant/40">·</span>
              <span class="truncate">Fédération MosaiX</span>
            </div>
            <h1 class="font-bold text-sm sm:text-base text-on-surface truncate">Flux Social & Espaces de Travail</h1>
          </div>
        </div>

        <!-- Right Controls & User Profile -->
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          ${renderHeaderSearchAndDevControls()}

          <!-- Live Theme Customizer Trigger Button -->
          <button onclick="toggleThemeCustomizerDrawer()" class="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-primary/20 hover:border-primary/40 transition text-primary flex items-center gap-1.5 cursor-pointer shadow-sm select-none" title="Ouvrir l'Éditeur Visuel Live">
            <span class="material-symbols-outlined text-base animate-spin-slow">palette</span>
            <span class="text-xs font-bold hidden xl:inline" id="live-editor-btn-label">Éditeur Visuel</span>
          </button>

          <!-- Dynamic Language Selector -->
          <div class="hidden lg:flex items-center gap-0.5 bg-surface-container-low border border-outline-variant/20 p-0.5 rounded-xl text-xs" id="mosaix-lang-selector">
            <button onclick="setLocale('fr')" id="lang-btn-fr" class="px-2 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">FR</button>
            <button onclick="setLocale('en')" id="lang-btn-en" class="px-2 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">EN</button>
            <button onclick="setLocale('ar')" id="lang-btn-ar" class="px-2 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">AR</button>
          </div>

          <div class="hidden lg:block h-5 w-px bg-outline-variant/20"></div>

          <!-- Dynamic Theme Toggle -->
          <div class="hidden lg:flex items-center gap-0.5 bg-surface-container-low border border-outline-variant/20 p-0.5 rounded-xl text-xs">
            <button onclick="setTheme('light')" class="px-2 py-1 rounded-lg transition ${activeMode === "light" ? "bg-primary text-on-primary font-bold shadow-sm" : "text-on-surface-variant hover:bg-surface-variant/30"}" title="Thème Clair">Light</button>
            <button onclick="setTheme('dark')" class="px-2 py-1 rounded-lg transition ${activeMode === "dark" ? "bg-primary text-on-primary font-bold shadow-sm" : "text-on-surface-variant hover:bg-surface-variant/30"}" title="Thème Sombre">Dark</button>
            <button onclick="setTheme('high-contrast')" class="px-2 py-1 rounded-lg transition ${activeMode === "high-contrast" ? "bg-primary text-on-primary font-bold shadow-sm" : "text-on-surface-variant hover:bg-surface-variant/30"}" title="Contraste Élevé">Contrast</button>
          </div>

          <div class="hidden lg:block h-5 w-px bg-outline-variant/20"></div>

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

          <!-- WELCOME ACTION-ORIENTED HERO BANNER -->
          <div class="glass-card rounded-3xl p-6 border border-primary/20 bg-gradient-to-br from-primary/10 via-surface-container-high/60 to-surface-container-high/30 shadow-xl space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/25 text-[11px] font-semibold text-primary mb-2">
                  <span>✨ Espace de Travail Unifié</span>
                </div>
                <h2 class="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                  Bonjour, <span class="text-primary">${escapeHtml(currentUser.name)}</span> 👋
                </h2>
                <p class="text-xs text-on-surface-variant/90 mt-1 max-w-xl">
                  Accédez instantanément à vos applications, échangez avec vos collègues et gérez vos espaces de travail partagés.
                </p>
              </div>

              <div class="flex items-center gap-2">
                <button onclick="openCommandPalette()" class="px-4 py-2.5 rounded-2xl bg-surface-container hover:bg-surface-variant border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-2 transition cursor-pointer shadow-sm">
                  <span class="material-symbols-outlined text-sm text-primary">search</span>
                  <span>Recherche Rapide</span>
                  <kbd class="text-[9px] px-1.5 py-0.5 rounded bg-surface-container-highest font-mono text-on-surface-variant">⌘K</kbd>
                </button>
              </div>
            </div>

            <!-- Quick Action Shortcut Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <a href="/spaces" class="p-3.5 rounded-2xl bg-surface-container/50 hover:bg-surface-container border border-outline-variant/15 hover:border-emerald-500/40 transition group cursor-pointer flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <span class="material-symbols-outlined text-xl">workspaces</span>
                </div>
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-on-surface group-hover:text-emerald-400 transition-colors">Espaces & Équipes</h4>
                  <p class="text-[10px] text-on-surface-variant/80 truncate">Gérer vos contextes</p>
                </div>
              </a>

              <a href="/portfolio" class="p-3.5 rounded-2xl bg-surface-container/50 hover:bg-surface-container border border-outline-variant/15 hover:border-primary/40 transition group cursor-pointer flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <span class="material-symbols-outlined text-xl">grid_view</span>
                </div>
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">Vos Applications</h4>
                  <p class="text-[10px] text-on-surface-variant/80 truncate">Boutique, Galerie, Agenda</p>
                </div>
              </a>

              <button onclick="const c = document.getElementById('composer-text'); if(c){ c.focus(); window.scrollTo({top: 250, behavior: 'smooth'}); }" class="p-3.5 rounded-2xl bg-surface-container/50 hover:bg-surface-container border border-outline-variant/15 hover:border-indigo-500/40 transition group cursor-pointer flex items-center gap-3 text-left">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <span class="material-symbols-outlined text-xl">edit_square</span>
                </div>
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-on-surface group-hover:text-indigo-400 transition-colors">Publier un message</h4>
                  <p class="text-[10px] text-on-surface-variant/80 truncate">Échanger avec le réseau</p>
                </div>
              </button>
            </div>
          </div>

          <!-- REAL-TIME SOLARA FEED COMPOSER -->
          <div class="glass-card rounded-2xl p-5 space-y-4 border border-outline-variant/20 shadow-xl bg-surface-container-high/30">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
                ${currentUser.avatar}
              </div>
              <div class="flex-1">
                <h2 class="font-bold text-sm text-on-surface flex items-center gap-2" id="shell-composer-title">
                  <span>Partager une mise à jour ou annonce</span>
                </h2>
                <p class="text-[11px] text-on-surface-variant">Publiez une information visible par l'ensemble de votre communauté</p>
              </div>
            </div>

            <div class="relative">
              <textarea id="composer-text" rows="3" placeholder="Exprimez-vous ou partagez une ressource..." class="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-xl p-3 text-xs text-on-surface focus:outline-none focus:border-primary transition resize-none placeholder:text-on-surface-variant/50"></textarea>
            </div>

            <div class="flex items-center justify-between pt-1">
              <div class="flex items-center gap-2 text-on-surface-variant text-xs">
                <button class="p-2 rounded-lg hover:bg-surface-variant/40 transition flex items-center gap-1.5 cursor-pointer" title="Joindre une photo">
                  <span class="material-symbols-outlined text-base">image</span>
                  <span class="text-[11px] hidden sm:inline">Média</span>
                </button>
                <button class="p-2 rounded-lg hover:bg-surface-variant/40 transition flex items-center gap-1.5 cursor-pointer" title="Créer un sondage">
                  <span class="material-symbols-outlined text-base text-indigo-400">how_to_vote</span>
                  <span class="text-[11px] hidden sm:inline">Sondage</span>
                </button>
                <button class="p-2 rounded-lg hover:bg-surface-variant/40 transition flex items-center gap-1.5 cursor-pointer" title="Rédiger un article">
                  <span class="material-symbols-outlined text-base text-emerald-400">chat_bubble</span>
                  <span class="text-[11px] hidden sm:inline">Message</span>
                </button>
              </div>

              <button onclick="publishPost()" class="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-primary/20 cursor-pointer">
                <span class="material-symbols-outlined text-sm">send</span>
                <span id="publish-btn-text">Publier</span>
              </button>
            </div>
          </div>

          <!-- ACTIVE EXPERIENCE CONTRACTS WIDGETS -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-base">dashboard_customize</span>
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Widgets & Blocs Pratiques</h3>
              </div>
              <span class="text-[10px] text-on-surface-variant font-medium">Accès rapide</span>
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
                  <button onclick="likePost('${escapeHtml(post.id)}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-variant/30 hover:text-rose-400 transition cursor-pointer">
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
            `,
              )
              .join("")}
          </div>

        </div>

        <!-- RIGHT SIDEBAR (TRENDS, QUICK APPS, RECENT UPDATES) -->
        <aside class="space-y-6">

          <!-- QUICK APPS LAUNCHPAD -->
          <div class="glass-card rounded-2xl p-5 space-y-4 border border-outline-variant/20 bg-surface-container-high/30">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-xs text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-base">apps</span>
                Vos Outils Principaux
              </h3>
              <a href="/spaces" class="text-[10px] font-bold text-primary hover:underline">Voir tout</a>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <a href="/commerce" class="p-2.5 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-outline-variant/15 transition flex flex-col gap-1 text-left group">
                <span class="text-lg">🛍️</span>
                <span class="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">Boutique</span>
                <span class="text-[9px] text-on-surface-variant/70">Produits & Vente</span>
              </a>

              <a href="/portfolio" class="p-2.5 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-outline-variant/15 transition flex flex-col gap-1 text-left group">
                <span class="text-lg">🎨</span>
                <span class="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">Portfolio</span>
                <span class="text-[9px] text-on-surface-variant/70">Galerie & Vitrine</span>
              </a>

              <a href="/beam" class="p-2.5 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-outline-variant/15 transition flex flex-col gap-1 text-left group">
                <span class="text-lg">💬</span>
                <span class="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">Messagerie</span>
                <span class="text-[9px] text-on-surface-variant/70">Salons & Direct</span>
              </a>

              <a href="/booking" class="p-2.5 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-outline-variant/15 transition flex flex-col gap-1 text-left group">
                <span class="text-lg">📅</span>
                <span class="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">Agenda</span>
                <span class="text-[9px] text-on-surface-variant/70">Prise de RDV</span>
              </a>
            </div>
          </div>

          <!-- TRENDING TOPICS -->
          <div class="glass-card rounded-2xl p-5 space-y-3 border border-outline-variant/20 bg-surface-container-high/30">
            <h3 class="font-bold text-xs text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base">trending_up</span>
              Actualités & Débats
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

  ${renderMobileBottomNav("/", currentUser, currentSpace)}
  ${renderShellToastContainer()}
  ${renderShellConfirmModal()}

  <script>
    async function setTheme(mode) {
      document.documentElement.setAttribute('data-theme-mode', mode);
      try {
        await fetch('/api/theme?mode=' + mode, { method: 'POST' });
      } catch (e) {}
      window.location.reload();
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
