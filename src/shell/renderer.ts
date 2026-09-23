import { escapeHtml } from "@mosaix/support";
import { UserProfile, USER_PROFILES, SpaceProfile, SPACES_LIST } from "./profiles.js";
import { shellRegistry } from "@mosaix/core";
import { apps, APP_ICONS } from "./discovery.js";
import { platformFeatureFlags } from "./feature-flags.js";
import "./contextual-actions";

// -----------------------------------------------------------------------------
// PRIMARY SIDEBAR RENDERER (FILTERED BY BAC AUTHORIZATION & FEATURE FLAGS)
// -----------------------------------------------------------------------------
export function renderPrimarySidebar(user: UserProfile, activeRoute: string, activeSpace?: SpaceProfile | null): string {
  // Filter visible BACs based on user's allowedBacs permission AND dynamic feature flags
  const allowedApps = apps.filter(app => {
    const isAllowedByRole = user.allowedBacs.includes(app.id) || user.allowedBacs.includes(app.id.replace(/^@apps\//, ""));
    if (!isAllowedByRole) return false;
    const flagKey = app.featureFlag || `apps.${app.id.replace(/^@apps\//, "")}.enabled`;
    return platformFeatureFlags.isEnabledSync(flagKey, true);
  });

  // Determine synchronized identity details for bottom avatar
  const displayAvatar = activeSpace ? activeSpace.avatar : user.avatar;
  const displayLabel = activeSpace ? activeSpace.name : user.name;
  const displayRole = activeSpace ? `${activeSpace.badge} Space` : user.roleLabel;

  return `
    <div class="hidden md:flex flex-col items-center w-[72px] shrink-0 bg-surface-container-lowest/80 backdrop-blur-2xl border-r border-outline-variant/20 py-6 z-[60] fixed left-0 top-0 h-full">
      <!-- App Brand Logo -->
      <a href="/" class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform duration-300 relative group/brand">
        <span class="material-symbols-outlined text-surface-container-lowest font-bold text-xl">temp_preferences_custom</span>
        <!-- Premium Brand Tooltip -->
        <div class="absolute left-[76px] px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-[11px] font-bold text-on-surface opacity-0 translate-x-2 pointer-events-none group-hover/brand:opacity-100 group-hover/brand:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-xl z-[70]">
          MosaiX Platform
        </div>
      </a>

      <!-- BAC Navigation Icons (RBAC Filtered) -->
      <nav id="mosaix-slot-shell-sidebar-primary" data-mosaix-slot="shell.sidebar.primary" class="flex flex-col gap-4 w-full items-center overflow-y-auto no-scrollbar py-2 transition-all">
        <!-- Home Navigation Item -->
        <a class="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group relative ${activeRoute === '/' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}" href="/">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">home</span>
          
          <!-- Discord-like active state indicator -->
          <div class="absolute left-0 w-1 bg-primary rounded-r-full transition-all duration-300 origin-left 
                      ${activeRoute === '/' ? 'h-6 scale-y-100' : 'h-2 scale-y-0 group-hover:h-4 group-hover:scale-y-100'}"></div>
                      
          <!-- Premium Floating Tooltip -->
          <div class="absolute left-[76px] px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-[11px] font-bold text-on-surface opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-xl z-[70]">
            Accueil Fil Social
          </div>
        </a>

        <div class="w-8 h-px bg-outline-variant/20 my-1"></div>

        <!-- Authorized BAC List -->
        ${allowedApps.map(app => {
          const isActive = activeRoute === app.route || activeRoute.startsWith(app.route + '/');
          return `
            <a class="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group relative ${isActive ? 'text-primary bg-primary/10 font-bold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}" href="${app.route}">
              <span class="text-xl group-hover:scale-110 transition-transform">${app.icon}</span>
              
              <!-- Discord-like active state indicator -->
              <div class="absolute left-0 w-1 bg-primary rounded-r-full transition-all duration-300 origin-left 
                          ${isActive ? 'h-6 scale-y-100' : 'h-2 scale-y-0 group-hover:h-4 group-hover:scale-y-100'}"></div>
                          
              <!-- Premium Floating Tooltip -->
              <div class="absolute left-[76px] px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-[11px] font-bold text-on-surface opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-xl z-[70]">
                ${escapeHtml(app.name)}
                <span class="block text-[9px] text-on-surface-variant font-medium mt-0.5">${escapeHtml(app.category)}</span>
              </div>
            </a>
          `;
        }).join("")}
      </nav>

      <!-- Bottom User Profile Avatar & Mobile Drawer Toggle -->
      <div class="mt-auto flex flex-col gap-4 w-full items-center pt-2">
        <button onclick="toggleMobileDrawer()" class="lg:hidden w-10 h-10 rounded-xl bg-surface-variant/50 text-on-surface flex items-center justify-center relative group/mob" title="Menu Mobile">
          <span class="material-symbols-outlined text-lg">menu</span>
          <div class="absolute left-[76px] px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-[11px] font-bold text-on-surface opacity-0 translate-x-2 pointer-events-none group-hover/mob:opacity-100 group-hover/mob:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-xl z-[70]">
            Menu Mobile
          </div>
        </button>

        <!-- Synchronized Bottom Profile Avatar (Displays active Space if selected) -->
        <div class="w-10 h-10 ${activeSpace ? 'rounded-xl' : 'rounded-full'} border-2 ${activeSpace ? 'border-emerald-500/50 hover:border-emerald-400' : 'border-outline-variant/30 hover:border-primary'} transition-all duration-300 cursor-pointer flex items-center justify-center ${activeSpace ? 'bg-emerald-600/20 text-emerald-400' : 'bg-indigo-600/30 text-primary'} font-bold text-base relative group/avatar">
          <span>${displayAvatar}</span>
          <span class="absolute -top-1 -right-1 w-3 h-3 rounded-full ${activeSpace ? 'bg-emerald-400' : 'bg-emerald-500'} border-2 border-surface"></span>
          
          <!-- Premium Profile Tooltip -->
          <div class="absolute left-[76px] bottom-0 px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-[11px] font-bold text-on-surface opacity-0 translate-x-2 pointer-events-none group-hover/avatar:opacity-100 group-hover/avatar:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-xl z-[70]">
            ${escapeHtml(displayLabel)}
            <span class="block text-[9px] ${activeSpace ? 'text-emerald-400' : 'text-primary'} font-medium mt-0.5">${escapeHtml(displayRole)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function isRouteActive(actionRoute: string, currentUrl: string): boolean {
  if (!currentUrl) return false;
  if (actionRoute === currentUrl) return true;
  const [actionPath, actionQuery] = actionRoute.split("?");
  const [currentPath, currentQuery] = currentUrl.split("?");
  
  if (actionQuery) {
    if (currentPath !== actionPath) return false;
    const actionParams = new URLSearchParams(actionQuery);
    const currentParams = new URLSearchParams(currentQuery || "");
    for (const [key, val] of actionParams.entries()) {
      if (currentParams.get(key) !== val) return false;
    }
    return true;
  }
  
  if (currentPath === actionPath) {
    return !currentQuery || currentQuery === "filter=all";
  }
  return false;
}

function getCtaConfig(bacId: string, customLabel?: string) {
  switch (bacId) {
    case "shell_home":
      return {
        label: customLabel || "Nouveau Pulse",
        icon: "edit_square",
        action: "const c = document.getElementById('composer-text'); if(c){ c.focus(); window.scrollTo({top: 0, behavior: 'smooth'}); }"
      };
    case "imperia":
      return {
        label: customLabel || "Créer Proposition",
        icon: "how_to_vote",
        action: "window.location.href='/imperia?action=new';"
      };
    case "commerce":
      return {
        label: customLabel || "Voir Panier",
        icon: "shopping_cart",
        action: "window.location.href='/commerce?view=cart';"
      };
    case "spaces":
      return {
        label: customLabel || "Nouveau Space",
        icon: "create_new_folder",
        action: "window.location.href='/spaces?action=create';"
      };
    case "solidarity":
      return {
        label: customLabel || "Participer à l'Aide",
        icon: "handshake",
        action: "window.location.href='/solidarity?view=help';"
      };
    case "beam":
      return {
        label: customLabel || "Nouveau Salon",
        icon: "add_comment",
        action: "window.location.href='/beam?view=channels';"
      };
    case "portfolio":
      return {
        label: customLabel || "Publier Œuvre",
        icon: "upload_file",
        action: "window.location.href='/portfolio?admin=new';"
      };
    case "booking":
      return {
        label: customLabel || "Prendre RDV",
        icon: "calendar_month",
        action: "window.location.href='/booking';"
      };
    case "identity":
      return {
        label: customLabel || "Gérer Profil SSO",
        icon: "manage_accounts",
        action: "window.location.href='/identity';"
      };
    default:
      return {
        label: customLabel || "Action Rapide",
        icon: "bolt",
        action: "const c = document.getElementById('composer-text'); if(c){ c.focus(); }"
      };
  }
}

// -----------------------------------------------------------------------------
// SECONDARY SIDEBAR RENDERER (CONTEXTUAL ACTIONS FILTERED BY PERMISSION)
// -----------------------------------------------------------------------------
export function renderSecondarySidebar(
  user: UserProfile, 
  activeBacId: string, 
  currentUrl: string = "/",
  activeSpace?: SpaceProfile | null
): string {
  const cleanBacId = (activeBacId || "").replace(/^@apps\//, "");
  const isImperia = cleanBacId === "imperia";
  const spaceLabel = activeSpace ? `${activeSpace.badge} ${activeSpace.name}` : "Réseau Principal";

  if (isImperia) {
    return `
      <nav id="mosaix-secondary-sidebar" class="secondary-sidebar hidden lg:flex flex-col w-64 shrink-0 bg-surface-container-low/80 fixed left-[72px] top-0 h-full border-r border-outline-variant/20 backdrop-blur-2xl py-5 px-3.5 gap-4 z-40 transition-all duration-300 select-none shadow-2xl">
        <!-- Context Header -->
        <div class="flex items-center justify-between pb-3.5 border-b border-outline-variant/15">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-surface-container-high/90 border border-outline-variant/30 flex items-center justify-center text-lg shrink-0 shadow-inner">
              🏛️
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <h1 class="font-bold text-sm text-on-surface tracking-tight truncate">Sénat Imperia</h1>
                <span class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
                  6/6
                </span>
              </div>
              <p class="text-[11px] text-primary/90 font-medium truncate mt-0.5">Management & Contrôle BACs</p>
            </div>
          </div>

          <!-- Collapse Trigger Inside Header -->
          <button onclick="toggleSecondarySidebar()" title="Replier la barre latérale" class="p-1.5 rounded-lg text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant/40 transition cursor-pointer shrink-0" aria-label="Replier la barre latérale">
            <span class="material-symbols-outlined text-base">chevron_left</span>
          </button>
        </div>

        <!-- Quick Instant Filter -->
        <div class="relative px-0.5">
          <input 
            type="text" 
            id="secondary-sidebar-filter" 
            placeholder="Filtrer les consoles..." 
            oninput="filterSecondarySidebar(this.value)"
            class="w-full bg-surface-container/60 hover:bg-surface-container focus:bg-surface-container border border-outline-variant/20 focus:border-primary/40 rounded-xl px-3 py-1.5 pl-8 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none transition shadow-inner"
          >
          <span class="material-symbols-outlined text-xs text-on-surface-variant/50 absolute left-3 top-2.5 pointer-events-none">search</span>
          <button 
            id="secondary-sidebar-filter-clear" 
            onclick="clearSecondarySidebarFilter()" 
            class="hidden absolute right-2.5 top-2 text-on-surface-variant/60 hover:text-on-surface text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
          >&times;</button>
        </div>

        <!-- Scrollable Menu of Integrated BAC Admin Pages -->
        <div id="mosaix-slot-shell-sidebar-secondary" data-mosaix-slot="shell.sidebar.secondary" class="flex flex-col gap-1 flex-grow overflow-y-auto pr-1 secondary-sidebar-scroll transition-all">
          <div class="flex items-center justify-between px-2 pt-1 mb-1">
            <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Cœur de Plateforme</span>
            <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface-variant/40 text-on-surface-variant/80">4</span>
          </div>
          
          <button onclick="switchAdminTab('metrics')" id="sidebar-tab-metrics" data-search="métriques logs télémétrie cluster monitoring" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">monitoring</span>
              <span class="truncate">Métriques & Logs</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span class="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span>
              LIVE
            </span>
          </button>

          <button onclick="switchAdminTab('feature-flags')" id="sidebar-tab-feature-flags" data-search="feature flags bascules toggles capacités modules runtime" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">toggle_on</span>
              <span class="truncate">Feature Flags</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">PORTS</span>
          </button>

          <button onclick="switchAdminTab('contracts')" id="sidebar-tab-contracts" data-search="contrats diagnostics conformité bac audit" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">approval_delegation</span>
              <span class="truncate">Contrats & Diagnostics</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-primary/20 text-primary border border-primary/30">6/6</span>
          </button>

          <button onclick="switchAdminTab('settings')" id="sidebar-tab-settings" data-search="configuration cluster cluster settings système" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">settings_applications</span>
              <span class="truncate">Configuration Cluster</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-surface-variant/50 text-on-surface-variant">VITE</span>
          </button>

          <div class="flex items-center justify-between px-2 pt-4 pb-1 mb-1 border-t border-outline-variant/10">
            <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Gestionnaires BAC</span>
            <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface-variant/40 text-on-surface-variant/80">6</span>
          </div>

          <button onclick="switchAdminTab('identity-admin')" id="sidebar-tab-identity-admin" data-search="gestion utilisateurs sso auth identity" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">manage_accounts</span>
              <span class="truncate">Gestion Utilisateurs</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">SSO</span>
          </button>

          <button onclick="switchAdminTab('solara-admin')" id="sidebar-tab-solara-admin" data-search="modération solara feed ia sécurité" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">shield</span>
              <span class="truncate">Modération Solara</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">IA</span>
          </button>

          <button onclick="switchAdminTab('beam-admin')" id="sidebar-tab-beam-admin" data-search="supervision beam messenger chat websocket" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">forum</span>
              <span class="truncate">Supervision Beam</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">RTC</span>
          </button>

          <button onclick="switchAdminTab('spaces-admin')" id="sidebar-tab-spaces-admin" data-search="quotas espaces spaces storage partition" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">workspaces</span>
              <span class="truncate">Quotas d'Espaces</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">STORE</span>
          </button>

          <button onclick="switchAdminTab('commerce-admin')" id="sidebar-tab-commerce-admin" data-search="livre commerce boutique commandes transactions" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">shopping_bag</span>
              <span class="truncate">Livre Commerce</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">PAY</span>
          </button>

          <button onclick="switchAdminTab('portfolio-admin')" id="sidebar-tab-portfolio-admin" data-search="registre créatif portfolio vitrine art" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">palette</span>
              <span class="truncate">Registre Créatif</span>
            </div>
            <span class="px-1.5 py-0.2 text-[9px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">NFT</span>
          </button>

          <div id="secondary-sidebar-empty-state" class="hidden text-center py-6 text-xs text-on-surface-variant/60 italic">
            Aucun outil trouvé.
          </div>
        </div>

        <!-- Quick Switch Back to Home & Telemetry Footer -->
        <div class="mt-auto pt-3 border-t border-outline-variant/15 flex flex-col gap-2">
          <a href="/" class="w-full bg-surface-container/60 hover:bg-surface-container text-on-surface border border-outline-variant/20 font-semibold py-2 px-3 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-xs group shadow-sm">
            <span class="material-symbols-outlined text-sm text-primary group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
            <span>Retour Accueil</span>
          </a>

          <div class="flex items-center justify-between px-1 text-[10px] text-on-surface-variant/60">
            <span class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Node Cluster
            </span>
            <span class="font-mono text-[9px] text-emerald-400 font-semibold">Stable</span>
          </div>
        </div>
      </nav>
    `;
  }

  const contextContribution = shellRegistry.getForBac(activeBacId) || shellRegistry.getForBac(cleanBacId) || shellRegistry.getForBac(`@apps/${cleanBacId}`) || shellRegistry.getForBac("shell_home");
  
  if (!contextContribution) {
    return `<div class="p-6 text-center text-on-surface-variant text-xs italic">Contexte introuvable.</div>`;
  }

  const { context, actions } = contextContribution;
  const contextIcon = APP_ICONS[cleanBacId] || APP_ICONS[activeBacId] || (cleanBacId === "shell_home" ? "🌐" : "⚡");
  const cta = getCtaConfig(cleanBacId, context.ctaLabel);
  
  // Filter actions based on specific user permission requirements
  const permittedActions = actions.filter(action => {
    if (!action.permission) return true;
    return user.permissions.includes(action.permission);
  });

  const allowedApps = apps.filter(a => {
    const isAllowedByRole = user.allowedBacs.includes(a.id) || user.allowedBacs.includes(a.id.replace(/^@apps\//, ""));
    if (!isAllowedByRole) return false;
    const flagKey = a.featureFlag || `apps.${a.id.replace(/^@apps\//, "")}.enabled`;
    return platformFeatureFlags.isEnabledSync(flagKey, true);
  });

  return `
    <nav id="mosaix-secondary-sidebar" class="secondary-sidebar hidden lg:flex flex-col w-64 shrink-0 bg-surface-container-low/80 fixed left-[72px] top-0 h-full border-r border-outline-variant/20 backdrop-blur-2xl py-5 px-3.5 gap-4 z-40 transition-all duration-300 select-none shadow-2xl">
      <!-- Context Header -->
      <div class="flex items-center justify-between pb-3.5 border-b border-outline-variant/15">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-surface-container-high/90 border border-outline-variant/30 flex items-center justify-center text-lg shrink-0 shadow-inner">
            ${contextIcon}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <h1 class="font-bold text-sm text-on-surface tracking-tight truncate">${escapeHtml(context.title)}</h1>
              <span class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
                Actif
              </span>
            </div>
            <p class="text-[11px] text-primary/90 font-medium truncate mt-0.5">${escapeHtml(context.subtitle)}</p>
          </div>
        </div>

        <!-- Collapse Trigger Inside Header -->
        <button onclick="toggleSecondarySidebar()" title="Replier la barre latérale" class="p-1.5 rounded-lg text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant/40 transition cursor-pointer shrink-0" aria-label="Replier la barre latérale">
          <span class="material-symbols-outlined text-base">chevron_left</span>
        </button>
      </div>

      <!-- Quick Instant Filter -->
      <div class="relative px-0.5">
        <input 
          type="text" 
          id="secondary-sidebar-filter" 
          placeholder="Filtrer les actions..." 
          oninput="filterSecondarySidebar(this.value)"
          class="w-full bg-surface-container/60 hover:bg-surface-container focus:bg-surface-container border border-outline-variant/20 focus:border-primary/40 rounded-xl px-3 py-1.5 pl-8 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none transition shadow-inner"
        >
        <span class="material-symbols-outlined text-xs text-on-surface-variant/50 absolute left-3 top-2.5 pointer-events-none">search</span>
        <button 
          id="secondary-sidebar-filter-clear" 
          onclick="clearSecondarySidebarFilter()" 
          class="hidden absolute right-2.5 top-2 text-on-surface-variant/60 hover:text-on-surface text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
        >&times;</button>
      </div>

      <!-- Contextual Action Items (Filtered by User Permissions) -->
      <div id="mosaix-slot-shell-sidebar-secondary" data-mosaix-slot="shell.sidebar.secondary" class="flex flex-col gap-1 flex-grow overflow-y-auto pr-1 secondary-sidebar-scroll transition-all">
        <div class="flex items-center justify-between px-2 pt-1 mb-1">
          <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Actions Contextuelles</span>
          <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface-variant/40 text-on-surface-variant/80">${permittedActions.length}</span>
        </div>
        
        ${permittedActions.length > 0 ? permittedActions.map(action => {
          const isActive = isRouteActive(action.route, currentUrl);
          return `
            <a class="sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 group text-xs font-medium ${isActive ? 'bg-primary/15 text-primary font-semibold border border-primary/25 shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 border border-transparent'}" href="${action.route}" data-search="${escapeHtml(action.label.toLowerCase())}">
              <div class="flex items-center gap-2.5 truncate">
                ${isActive ? `<span class="w-1 h-3.5 rounded-full bg-primary shrink-0"></span>` : ''}
                <span class="material-symbols-outlined text-base ${isActive ? 'text-primary' : 'text-primary/80'} group-hover:scale-110 transition-transform">${action.icon}</span>
                <span class="truncate">${escapeHtml(action.label)}</span>
              </div>
              ${action.badge ? `<span class="px-1.5 py-0.2 text-[9px] font-bold rounded ${action.badgeClass || 'bg-primary/20 text-primary'}">${escapeHtml(action.badge)}</span>` : ''}
            </a>
          `;
        }).join("") : `
          <p class="text-xs text-on-surface-variant/60 p-2 italic">Aucune action disponible pour votre niveau de permission.</p>
        `}

        <div class="flex items-center justify-between px-2 pt-4 pb-1 mb-1 border-t border-outline-variant/10">
          <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Modules Autorisés</span>
          <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface-variant/40 text-on-surface-variant/80">${allowedApps.length}</span>
        </div>

        ${allowedApps.map(app => {
          const isAppActive = app.id === activeBacId;
          return `
            <a class="sidebar-nav-item flex items-center justify-between px-3 py-1.5 rounded-xl transition-all duration-200 group text-xs ${isAppActive ? 'bg-primary/10 text-primary border border-primary/20 font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 border border-transparent'}" href="${app.route}" data-search="${escapeHtml(app.name.toLowerCase())}">
              <div class="flex items-center gap-2.5 truncate">
                <span class="text-sm group-hover:scale-110 transition-transform">${app.icon}</span>
                <span class="truncate">${escapeHtml(app.name)}</span>
              </div>
              ${isAppActive ? `<span class="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-primary/20 text-primary flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-primary animate-pulse"></span>Actif</span>` : ''}
            </a>
          `;
        }).join("")}

        <div id="secondary-sidebar-empty-state" class="hidden text-center py-6 text-xs text-on-surface-variant/60 italic">
          Aucun résultat pour cette recherche.
        </div>
      </div>

      <!-- Context Call to Action & Space Indicator -->
      <div class="mt-auto pt-3 border-t border-outline-variant/15 flex flex-col gap-2">
        <button onclick="${cta.action}" class="w-full bg-primary hover:bg-primary/90 text-on-primary font-bold py-2.5 px-4 rounded-xl transition-all duration-200 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs border border-primary/30">
          <span class="material-symbols-outlined text-sm">${cta.icon}</span>
          <span>${escapeHtml(cta.label)}</span>
        </button>

        <div class="flex items-center justify-between px-1 text-[10px] text-on-surface-variant/60">
          <span class="flex items-center gap-1.5 truncate">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
            <span class="truncate">${escapeHtml(spaceLabel)}</span>
          </span>
          <span class="font-mono text-[9px] opacity-75 shrink-0 ml-2">v1.2</span>
        </div>
      </div>
    </nav>
  `;
}

// -----------------------------------------------------------------------------
// USER SWITCHER & CONTEXT DROPDOWN HEADER COMPONENT
// -----------------------------------------------------------------------------
export function renderUserSwitcherWidget(user: UserProfile, activeSpace?: SpaceProfile | null): string {
  const userSpaces = SPACES_LIST.filter(space => {
    if (user.role === "admin") return true;
    return space.ownerUserRole === user.role;
  });

  const displayAvatar = activeSpace ? activeSpace.avatar : user.avatar;
  const displayName = activeSpace ? activeSpace.name : user.name;
  const displayLabel = activeSpace ? `${activeSpace.badge} Space` : user.roleLabel;

  return `
    <div class="relative group">
      <!-- Outer Avatar Switcher Button -->
      <div class="flex items-center gap-2.5 bg-surface-variant/30 hover:bg-surface-variant/50 border border-outline-variant/20 p-1.5 pr-3 rounded-full transition-all cursor-pointer">
        <div class="w-8 h-8 rounded-full bg-indigo-600/30 text-primary border border-primary/30 flex items-center justify-center font-bold text-sm">
          ${displayAvatar}
        </div>
        <div class="hidden sm:flex flex-col">
          <span class="font-bold text-xs text-on-surface leading-tight">${escapeHtml(displayName)}</span>
          <span class="text-[10px] font-semibold px-1.5 py-0.2 rounded border ${activeSpace ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : user.badgeClass} mt-0.5">${displayLabel}</span>
        </div>
        <span class="material-symbols-outlined text-on-surface-variant text-sm group-hover:text-on-surface transition-colors">expand_more</span>
      </div>

      <!-- Facebook-inspired User & Space Menu Dropdown -->
      <div class="absolute right-0 top-full mt-2 w-80 bg-surface-container-high border border-outline-variant/30 rounded-2xl shadow-2xl p-3 hidden group-hover:block z-50 backdrop-blur-2xl animate-fade-in space-y-3">
        
        <!-- SECTION 1: Unified Active Identity Header Card (Visual Extension Container) -->
        <div class="rounded-xl border border-outline-variant/15 bg-surface-variant/10 overflow-hidden transition-all duration-300">
          
          <!-- Upper Identity Header -->
          <div class="flex items-center justify-between p-2.5 transition duration-300 relative group/card hover:bg-surface-variant/20">
            <a href="/profile" onclick="event.preventDefault(); alert('Profil de ${escapeHtml(displayName)}')" class="flex items-center gap-3 flex-1 min-w-0">
              <div class="relative shrink-0">
                <div class="w-11 h-11 rounded-full ${activeSpace ? 'bg-emerald-600/20 text-emerald-400 border-emerald-400/30' : 'bg-indigo-600/20 text-primary border border-primary/30'} flex items-center justify-center font-bold text-lg transition duration-300">
                  ${displayAvatar}
                </div>
                <!-- Mini secondary overlapping badge representing the switch target -->
                <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border border-surface-container-high bg-surface-container flex items-center justify-center text-[10px] shadow-sm select-none">
                  ${activeSpace ? user.avatar : (userSpaces[0]?.avatar || '👤')}
                </div>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-bold text-sm text-on-surface leading-tight truncate group-hover/card:text-primary transition duration-150">${escapeHtml(displayName)}</span>
                <span class="text-[10px] text-on-surface-variant mt-0.5 font-semibold truncate">
                  ${activeSpace ? `${activeSpace.badge} Space • Actif` : 'Compte Personnel'}
                </span>
              </div>
            </a>

            <!-- Trigger Button: Rotates and expands the drawer seamlessly -->
            ${userSpaces.length > 0 ? `
              <button onclick="event.stopPropagation(); const d = document.getElementById('usermenu-spaces-dropdown'); d.classList.toggle('hidden');" 
                      title="Changer de compte ou d'espace" 
                      class="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition duration-300 cursor-pointer shrink-0 ml-2 relative group/switchbtn hover:scale-115 active:scale-95"
                      id="usermenu-profile-card-switch">
                <span class="material-symbols-outlined text-base font-bold transition-transform duration-500 group-hover/switchbtn:rotate-90">swap_horiz</span>
              </button>
            ` : ''}
          </div>

          <!-- Seamless Drawer Extension (Dropdown embedded directly inside the active card's border boundaries) -->
          ${userSpaces.length > 0 ? `
            <div id="usermenu-spaces-dropdown" class="border-t border-outline-variant/10 bg-surface-variant/20 p-1.5 hidden animate-fade-in space-y-1">
              <div class="px-2 py-1">
                <p class="text-[9px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Changer d'identité active</p>
              </div>
              
              <!-- Personal User Option -->
              <button onclick="switchActiveSpace('none')" class="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-variant/40 transition text-left cursor-pointer ${!activeSpace ? 'bg-primary/10 border border-primary/20' : ''}">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-7 h-7 rounded-full bg-indigo-600/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                    ${user.avatar}
                  </div>
                  <div class="min-w-0">
                    <p class="text-[11px] font-bold text-on-surface leading-tight truncate">${user.name}</p>
                    <p class="text-[9px] text-on-surface-variant truncate">Compte personnel</p>
                  </div>
                </div>
                ${!activeSpace ? '<span class="material-symbols-outlined text-primary text-xs font-bold">check</span>' : ''}
              </button>

              <!-- Space Options -->
              ${userSpaces.map(space => {
                const isCurrent = activeSpace && activeSpace.id === space.id;
                return `
                  <button onclick="switchActiveSpace('${space.id}')" class="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-variant/40 transition text-left cursor-pointer ${isCurrent ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xs font-bold shrink-0">
                        ${space.avatar}
                      </div>
                      <div class="min-w-0">
                        <p class="text-[11px] font-bold text-on-surface leading-tight truncate">${space.name}</p>
                        <p class="text-[9px] text-on-surface-variant truncate">${space.handle} • ${space.badge}</p>
                      </div>
                    </div>
                    ${isCurrent ? '<span class="material-symbols-outlined text-emerald-400 text-xs font-bold">check</span>' : ''}
                  </button>
                `;
              }).join("")}
            </div>
          ` : ''}
        </div>

        <hr class="border-outline-variant/10" />

        <!-- SECTION 3: System Shortcuts -->
        <div class="space-y-0.5">
          <a href="/imperia" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/40 transition text-left text-xs font-semibold text-on-surface cursor-pointer">
            <span class="material-symbols-outlined text-primary text-base">settings</span>
            <span>Paramètres de la Plateforme</span>
          </a>

          <button onclick="(async () => {
            const cur = document.documentElement.getAttribute('data-theme-mode') || 'dark';
            const nxt = cur === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme-mode', nxt);
            try { await fetch('/api/theme?mode=' + nxt, { method: 'POST' }); } catch(e) {}
          })()" class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-variant/40 transition text-left text-xs font-semibold text-on-surface cursor-pointer">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-primary text-base">dark_mode</span>
              <span>Mode Sombre</span>
            </div>
            <div class="w-8 h-4 bg-primary/20 rounded-full relative p-0.5 transition flex items-center justify-between">
              <div class="w-3 h-3 bg-primary rounded-full transition-transform"></div>
            </div>
          </button>
        </div>

        <hr class="border-outline-variant/10" />

        <!-- SECTION 4: Collapsible Role Switcher -->
        <details class="group/details">
          <summary class="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-variant/40 transition text-xs font-semibold text-on-surface cursor-pointer list-none">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-primary text-base">person</span>
              <span>Comptes Test RBAC (${Object.keys(USER_PROFILES).length})</span>
            </div>
            <span class="material-symbols-outlined text-xs text-on-surface-variant group-open/details:rotate-180 transition-transform">expand_more</span>
          </summary>
          <div class="pl-2 pr-1 pt-1.5 pb-1 space-y-1">
            ${Object.values(USER_PROFILES).map(profile => `
              <button onclick="switchUserRole('${profile.role}')" class="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-variant/30 transition text-left cursor-pointer ${profile.role === user.role && !activeSpace ? 'bg-primary/10 border border-primary/20' : ''}">
                <div class="flex items-center gap-2">
                  <span class="text-sm">${profile.avatar}</span>
                  <div>
                    <p class="text-[11px] font-bold text-on-surface leading-tight">${profile.name}</p>
                    <p class="text-[9px] text-on-surface-variant mt-0.5">${profile.roleLabel}</p>
                  </div>
                </div>
                ${profile.role === user.role && !activeSpace ? '<span class="material-symbols-outlined text-primary text-xs font-bold">check</span>' : ''}
              </button>
            `).join("")}
          </div>
        </details>

        <!-- SECTION 5: Slot Container (shell.usermenu.actions) -->
        <div id="mosaix-slot-shell-usermenu-actions" data-mosaix-slot="shell.usermenu.actions" class="border-t border-outline-variant/10 pt-2 space-y-2">
          
          <!-- Contribution 1: Imperia Governance Context Switcher -->
          <div class="p-2 rounded-xl bg-surface-variant/20 border border-outline-variant/10">
            <label class="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1 flex items-center gap-1">
               <span>🏛️ Imperia</span> • Contexte Org
            </label>
            <select onchange="alert('Changement de tenant : ' + this.value)" class="w-full bg-surface-variant/60 border border-outline-variant/30 text-[11px] font-bold text-on-surface rounded-lg p-1.5 outline-none cursor-pointer">
              <option value="tenant-main" selected>🏢 MosaiX Global Workspace</option>
              <option value="tenant-solara">☀️ Solara Social Org</option>
              <option value="tenant-imperia">🏛️ Imperia Council Org</option>
            </select>
          </div>

          <!-- Contribution 2: Beam Presence Status Picker -->
          <div class="flex items-center justify-between p-2 rounded-xl bg-surface-variant/20 border border-outline-variant/10 text-xs font-medium">
            <div class="flex items-center gap-1.5 text-on-surface">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Statut Beam</span>
            </div>
            <select onchange="alert('Statut mis à jour : ' + this.value)" class="bg-surface-variant/60 border border-outline-variant/20 text-[10px] font-bold text-on-surface rounded px-1.5 py-0.5 outline-none cursor-pointer">
              <option value="online">En Ligne</option>
              <option value="busy">Occupé</option>
              <option value="away">Absent</option>
            </select>
          </div>

          <!-- Contribution 3: Identity Security & MFA Settings -->
          <button onclick="alert('Ouverture des paramètres de sécurité MFA & Clés API')" class="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-variant/50 text-xs font-semibold text-on-surface transition cursor-pointer">
            <span class="material-symbols-outlined text-primary text-base">shield_lock</span>
            <span>Paramètres de Sécurité & MFA</span>
          </button>

        </div>

        <!-- SECTION 6: Log Out Action -->
        <div class="border-t border-outline-variant/10 pt-2">
          <button onclick="alert('Déconnexion réussie ! Redirection...')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition text-xs font-bold cursor-pointer">
            <span class="material-symbols-outlined text-base">logout</span>
            <span>Déconnexion</span>
          </button>
        </div>

      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// MOBILE DRAWER COMPONENT (SHARED ACROSS TEMPLATES)
// -----------------------------------------------------------------------------
export function renderMobileDrawer(user: UserProfile, activeRoute: string, activeMode: string): string {
  const allowedApps = apps.filter(app => {
    const isAllowedByRole = user.allowedBacs.includes(app.id) || user.allowedBacs.includes(app.id.replace(/^@apps\//, ""));
    if (!isAllowedByRole) return false;
    const flagKey = app.featureFlag || `apps.${app.id.replace(/^@apps\//, "")}.enabled`;
    return platformFeatureFlags.isEnabledSync(flagKey, true);
  });
  
  return `
    <div id="mobile-drawer" class="fixed inset-0 z-[100] hidden bg-background/60 backdrop-blur-md transition-opacity duration-300 animate-fade-in" onclick="toggleMobileDrawer()">
      <div class="fixed inset-y-0 left-0 w-72 bg-surface-container-high p-5 flex flex-col justify-between shadow-2xl border-r border-outline-variant/20 transition-transform duration-300 ease-out" onclick="event.stopPropagation()">
        
        <div class="space-y-5 flex-1 flex flex-col min-h-0">
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-xl">temp_preferences_custom</span>
              <span class="font-bold text-sm text-on-surface">Menu Principal</span>
            </div>
            <button onclick="toggleMobileDrawer()" class="w-8 h-8 rounded-full hover:bg-surface-variant/50 text-on-surface-variant hover:text-on-surface flex items-center justify-center transition font-bold text-base">&times;</button>
          </div>

          <!-- Allowed BACs Navigation -->
          <div class="flex-1 overflow-y-auto no-scrollbar space-y-4">
            <div>
              <p class="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-2 px-2">Navigation</p>
              <div class="space-y-1">
                <a href="/" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface hover:bg-surface-variant/40 font-semibold text-xs transition ${activeRoute === '/' ? 'bg-primary/10 text-primary border border-primary/20' : ''}">
                  <span class="material-symbols-outlined text-base">home</span>
                  <span>Accueil Fil Social</span>
                </a>
              </div>
            </div>

            <div>
              <p class="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-2 px-2">BACs Autorisés (${allowedApps.length})</p>
              <div class="space-y-1">
                ${allowedApps.map(app => {
                  const isActive = activeRoute === app.route || activeRoute.startsWith(app.route + '/');
                  return `
                    <a href="${app.route}" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface hover:bg-surface-variant/40 font-semibold text-xs transition ${isActive ? 'bg-primary/10 text-primary border border-primary/20' : ''}">
                      <span class="text-base">${app.icon}</span>
                      <span>${app.name}</span>
                    </a>
                  `;
                }).join("")}
              </div>
            </div>
          </div>
        </div>

        <!-- Drawer Footer: Theme Selector -->
        <div class="border-t border-outline-variant/20 pt-4 mt-auto space-y-3 bg-surface-container-high">
          <p class="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-wider px-2">Thème de l'interface</p>
          <div class="grid grid-cols-3 gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs">
            <button onclick="setTheme('light'); toggleMobileDrawer();" class="py-1.5 rounded-lg transition text-center ${activeMode === 'light' ? 'bg-primary text-on-primary font-bold shadow' : 'text-on-surface-variant hover:text-on-surface'}">Light</button>
            <button onclick="setTheme('dark'); toggleMobileDrawer();" class="py-1.5 rounded-lg transition text-center ${activeMode === 'dark' ? 'bg-primary text-on-primary font-bold shadow' : 'text-on-surface-variant hover:text-on-surface'}">Dark</button>
            <button onclick="setTheme('high-contrast'); toggleMobileDrawer();" class="py-1.5 rounded-lg transition text-center ${activeMode === 'high-contrast' ? 'bg-primary text-on-primary font-bold shadow' : 'text-on-surface-variant hover:text-on-surface'}">Contrast</button>
          </div>
        </div>

      </div>
    </div>
  `;
}
export { getActiveUserProfile } from "./profiles.js";
