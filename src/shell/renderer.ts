import { escapeHtml } from "@mosaix/support";
import {
  UserProfile,
  USER_PROFILES,
  SpaceProfile,
  SPACES_LIST,
  isDemoMode,
} from "./profiles.js";
import { shellRegistry } from "@mosaix/core";
import { apps, APP_ICONS } from "./discovery.js";
import {
  platformFeatureFlags,
  DEFAULT_PLATFORM_FLAGS,
} from "./feature-flags.js";
import { IMPERIA_NAV_SECTIONS } from "./imperia-nav.js";
import "./contextual-actions";

function getUserAllowedBacs(user?: UserProfile): string[] {
  if (user && Array.isArray(user.allowedBacs)) {
    return user.allowedBacs;
  }
  return [
    "identity",
    "solara",
    "solidarity",
    "commerce",
    "spaces",
    "portfolio",
    "booking",
    "beam",
    "subscription",
  ];
}

function getUserPermissions(user?: UserProfile): string[] {
  if (user && Array.isArray(user.permissions)) {
    return user.permissions;
  }
  return [];
}

// -----------------------------------------------------------------------------
// PRIMARY SIDEBAR RENDERER (FILTERED BY BAC AUTHORIZATION & FEATURE FLAGS)
// -----------------------------------------------------------------------------
export function renderPrimarySidebar(
  user: UserProfile,
  activeRoute: string,
  activeSpace?: SpaceProfile | null,
): string {
  // Filter visible BACs based on user's allowedBacs permission AND dynamic feature flags
  const userBacs = getUserAllowedBacs(user);
  const allowedApps = apps.filter((app) => {
    const isAllowedByRole =
      userBacs.includes(app.id) ||
      userBacs.includes(app.id.replace(/^@apps\//, ""));
    if (!isAllowedByRole) return false;
    const flagKey =
      app.featureFlag || `apps.${app.id.replace(/^@apps\//, "")}.enabled`;
    return platformFeatureFlags.isEnabledSync(flagKey, true);
  });

  // Determine synchronized identity details for bottom avatar
  const displayAvatar = activeSpace ? activeSpace.avatar : user.avatar;
  const displayLabel = activeSpace ? activeSpace.name : user.name;
  const displayRole = activeSpace
    ? `${activeSpace.badge} Space`
    : user.roleLabel;

  return `
    <div class="hidden md:flex flex-col items-center w-[76px] shrink-0 bg-surface-container-lowest/90 backdrop-blur-2xl border-r border-outline-variant/15 py-5 z-[60] fixed left-0 top-0 h-full shadow-2xl select-none">
      <!-- App Brand Logo & Quick Command Trigger -->
      <a href="/" class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary via-indigo-500 to-secondary flex items-center justify-center mb-4 shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all duration-300 relative group/brand border border-primary/20">
        <span class="material-symbols-outlined text-surface-container-lowest font-extrabold text-2xl group-hover:rotate-12 transition-transform">auto_awesome</span>
        
        <!-- Premium Brand Tooltip -->
        <div class="absolute left-[84px] px-3 py-2 rounded-xl bg-surface-container-highest/95 border border-outline-variant/30 text-xs font-bold text-on-surface opacity-0 translate-x-3 pointer-events-none group-hover/brand:opacity-100 group-hover/brand:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-2xl z-[70] backdrop-blur-xl">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span>MosaiX Platform</span>
          </div>
          <span class="block text-[10px] text-on-surface-variant/80 font-normal mt-0.5">Système Décentralisé</span>
        </div>
      </a>

      <!-- Quick Command Trigger Button -->
      <button onclick="if(typeof openCommandPalette==='function'){openCommandPalette();}else{const f=document.getElementById('secondary-sidebar-filter');if(f)f.focus();}" class="w-10 h-10 rounded-xl bg-surface-variant/30 hover:bg-surface-variant/60 text-on-surface-variant hover:text-on-surface flex items-center justify-center mb-3 transition-all duration-200 group/cmd relative cursor-pointer border border-outline-variant/10">
        <span class="material-symbols-outlined text-lg group-hover/cmd:scale-110 transition-transform">search</span>
        <div class="absolute left-[84px] px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/30 text-[11px] font-bold text-on-surface opacity-0 translate-x-3 pointer-events-none group-hover/cmd:opacity-100 group-hover/cmd:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-xl z-[70]">
          Recherche Rapide <span class="ml-1 text-[9px] font-mono px-1 py-0.5 rounded bg-surface-variant text-primary border border-primary/20">⌘K</span>
        </div>
      </button>

      <div class="w-8 h-px bg-outline-variant/15 mb-3"></div>

      <!-- BAC Navigation Icons (RBAC Filtered) -->
      <nav id="mosaix-slot-shell-sidebar-primary" data-mosaix-slot="shell.sidebar.primary" class="flex flex-col gap-3 w-full items-center overflow-y-auto no-scrollbar py-1 transition-all">
        <!-- Home Navigation Item -->
        <a class="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 group relative ${activeRoute === "/" ? "text-primary bg-primary/15 font-bold shadow-md shadow-primary/10 border border-primary/30" : "text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-variant/40 border border-transparent"}" href="/">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">home</span>
          
          <!-- Active Pill Indicator -->
          <div class="absolute left-0 w-1 bg-primary rounded-r-full transition-all duration-300 origin-left 
                      ${activeRoute === "/" ? "h-7 scale-y-100 shadow-sm shadow-primary/50" : "h-2 scale-y-0 group-hover:h-4 group-hover:scale-y-100"}"></div>
                      
          <!-- Premium Floating Tooltip -->
          <div class="absolute left-[84px] px-3 py-2 rounded-xl bg-surface-container-highest/95 border border-outline-variant/30 text-xs font-bold text-on-surface opacity-0 translate-x-3 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-2xl z-[70] backdrop-blur-xl">
            <span>Accueil Fil Social</span>
            <span class="block text-[10px] text-primary font-medium mt-0.5">Flux Général MosaiX</span>
          </div>
        </a>

        <div class="w-8 h-px bg-outline-variant/15 my-0.5"></div>

        <!-- Authorized BAC List -->
        ${allowedApps
          .map((app) => {
            const isActive =
              activeRoute === app.route ||
              activeRoute.startsWith(app.route + "/");
            const isBeam = app.id === "@apps/beam" || app.id === "beam";
            return `
            <a class="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 group relative ${isActive ? "text-primary bg-primary/15 font-bold shadow-md shadow-primary/10 border border-primary/30" : "text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-variant/40 border border-transparent"}" href="${app.route}">
              <span class="text-xl group-hover:scale-110 transition-transform">${app.icon}</span>
              
              <!-- Badge notification indicator for Beam/Solara -->
              ${isBeam ? `<span class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface animate-pulse"></span>` : ""}

              <!-- Active Pill Indicator -->
              <div class="absolute left-0 w-1 bg-primary rounded-r-full transition-all duration-300 origin-left 
                          ${isActive ? "h-7 scale-y-100 shadow-sm shadow-primary/50" : "h-2 scale-y-0 group-hover:h-4 group-hover:scale-y-100"}"></div>
                          
              <!-- Premium Floating Tooltip -->
              <div class="absolute left-[84px] px-3 py-2 rounded-xl bg-surface-container-highest/95 border border-outline-variant/30 text-xs font-bold text-on-surface opacity-0 translate-x-3 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-2xl z-[70] backdrop-blur-xl">
                <span>${escapeHtml(app.name)}</span>
                <span class="block text-[10px] text-primary/80 font-medium mt-0.5">${escapeHtml(app.category)}</span>
              </div>
            </a>
          `;
          })
          .join("")}
      </nav>

      <!-- Bottom User Profile Avatar & Mobile Drawer Toggle -->
      <div class="mt-auto flex flex-col gap-3 w-full items-center pt-3 border-t border-outline-variant/15">
        <button onclick="toggleMobileDrawer()" class="lg:hidden w-10 h-10 rounded-xl bg-surface-variant/40 text-on-surface flex items-center justify-center relative group/mob cursor-pointer hover:bg-surface-variant/70 transition-colors" title="Menu Mobile">
          <span class="material-symbols-outlined text-lg">menu</span>
          <div class="absolute left-[84px] px-3 py-2 rounded-xl bg-surface-container-highest border border-outline-variant/30 text-xs font-bold text-on-surface opacity-0 translate-x-3 pointer-events-none group-hover/mob:opacity-100 group-hover/mob:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-xl z-[70]">
            Menu Mobile
          </div>
        </button>

        <!-- Synchronized Bottom Profile Avatar (Displays active Space if selected) -->
        <a href="/identity" class="w-11 h-11 ${activeSpace ? "rounded-2xl" : "rounded-full"} border-2 ${activeSpace ? "border-emerald-500/60 hover:border-emerald-400 shadow-lg shadow-emerald-500/20" : "border-outline-variant/30 hover:border-primary shadow-lg shadow-indigo-500/10"} transition-all duration-300 cursor-pointer flex items-center justify-center ${activeSpace ? "bg-emerald-600/20 text-emerald-400" : "bg-indigo-600/25 text-primary"} font-bold text-base relative group/avatar">
          <span>${displayAvatar}</span>
          <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${activeSpace ? "bg-emerald-400" : "bg-emerald-500"} border-2 border-surface flex items-center justify-center text-[7px] font-bold text-surface-container-lowest">✓</span>
          
          <!-- Premium Profile Tooltip -->
          <div class="absolute left-[84px] bottom-0 px-3 py-2 rounded-xl bg-surface-container-highest/95 border border-outline-variant/30 text-xs font-bold text-on-surface opacity-0 translate-x-3 pointer-events-none group-hover/avatar:opacity-100 group-hover/avatar:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-2xl z-[70] backdrop-blur-xl">
            <span>${escapeHtml(displayLabel)}</span>
            <span class="block text-[10px] ${activeSpace ? "text-emerald-400" : "text-primary"} font-medium mt-0.5">${escapeHtml(displayRole)}</span>
          </div>
        </a>
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
        action:
          "const c = document.getElementById('composer-text'); if(c){ c.focus(); window.scrollTo({top: 0, behavior: 'smooth'}); }",
      };
    case "imperia":
      return {
        label: customLabel || "Créer Proposition",
        icon: "how_to_vote",
        action: "window.location.href='/imperia?action=new';",
      };
    case "commerce":
      return {
        label: customLabel || "Voir Panier",
        icon: "shopping_cart",
        action: "window.location.href='/commerce?view=cart';",
      };
    case "spaces":
      return {
        label: customLabel || "Nouveau Space",
        icon: "create_new_folder",
        action: "window.location.href='/spaces?action=create';",
      };
    case "solidarity":
      return {
        label: customLabel || "Participer à l'Aide",
        icon: "handshake",
        action: "window.location.href='/solidarity?view=help';",
      };
    case "beam":
      return {
        label: customLabel || "Nouveau Salon",
        icon: "add_comment",
        action: "window.location.href='/beam?view=channels';",
      };
    case "portfolio":
      return {
        label: customLabel || "Publier Œuvre",
        icon: "upload_file",
        action: "window.location.href='/portfolio?admin=new';",
      };
    case "booking":
      return {
        label: customLabel || "Prendre RDV",
        icon: "calendar_month",
        action: "window.location.href='/booking';",
      };
    case "identity":
      return {
        label: customLabel || "Gérer Profil SSO",
        icon: "manage_accounts",
        action: "window.location.href='/identity';",
      };
    default:
      return {
        label: customLabel || "Action Rapide",
        icon: "bolt",
        action:
          "const c = document.getElementById('composer-text'); if(c){ c.focus(); }",
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
  activeSpace?: SpaceProfile | null,
): string {
  const cleanBacId = (activeBacId || "").replace(/^@apps\//, "");
  const isImperia = cleanBacId === "imperia";
  const spaceLabel = activeSpace
    ? `${activeSpace.badge} ${activeSpace.name}`
    : "Réseau Principal";

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
                <h1 class="font-bold text-sm text-on-surface tracking-tight truncate">Gouvernance</h1>
                <span class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
                  En direct
                </span>
              </div>
              <p class="text-[11px] text-primary/90 font-medium truncate mt-0.5">Décisions & Consultations</p>
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
            placeholder="Rechercher une section..." 
            oninput="filterSecondarySidebar(this.value)"
            class="w-full bg-surface-container/60 hover:bg-surface-container focus:bg-surface-container border border-outline-variant/20 focus:border-primary/40 rounded-xl px-3 py-1.5 pl-8 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none transition shadow-inner"
          >
          <span class="material-symbols-outlined text-xs text-on-surface-variant/50 absolute left-3 top-2.5 pointer-events-none">search</span>
          <button 
            id="secondary-sidebar-filter-clear" 
            onclick="clearSecondarySidebarFilter()" 
            class="hidden absolute right-2.5 top-2 text-on-surface-variant/60 hover:text-on-surface text-xs font-bold w-4 h-4 rounded-full items-center justify-center cursor-pointer"
          >&times;</button>
        </div>

        <!-- Scrollable Menu of Integrated BAC Admin Pages -->
        <div id="mosaix-slot-shell-sidebar-secondary" data-mosaix-slot="shell.sidebar.secondary" class="flex flex-col gap-1 flex-grow overflow-y-auto pr-1 secondary-sidebar-scroll transition-all">
          ${IMPERIA_NAV_SECTIONS.map(
            (section, sIdx) => `
            <div class="flex items-center justify-between px-2 pb-1 mb-1 ${sIdx === 0 ? "pt-1" : "pt-4 border-t border-outline-variant/10"}">
              <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider">${escapeHtml(section.title)}</span>
              <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface-variant/40 text-on-surface-variant/80">${section.items.length}</span>
            </div>

            ${section.items
              .map(
                (item) => `
              <button onclick="switchAdminTab('${escapeHtml(item.id)}')" id="sidebar-tab-${item.id}" data-search="${escapeHtml(item.searchKeywords)}" class="admin-tab-btn sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 transition-all duration-200 group text-xs font-medium w-full text-left cursor-pointer border border-transparent">
                <div class="flex items-center gap-2.5 truncate">
                  <span class="material-symbols-outlined text-base text-primary/80 group-hover:scale-110 transition-transform">${escapeHtml(item.icon)}</span>
                  <span class="truncate">${escapeHtml(item.label)}</span>
                </div>
                ${
                  item.badgeText
                    ? `
                  <span class="px-1.5 py-0.2 text-[9px] font-bold rounded ${item.badgeClass || "bg-primary/20 text-primary"} ${item.isLive ? "flex items-center gap-1" : ""}">
                    ${item.isLive ? '<span class="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span>' : ""}
                    ${escapeHtml(item.badgeText)}
                  </span>
                `
                    : ""
                }
              </button>
            `,
              )
              .join("")}
          `,
          ).join("")}

          <div id="secondary-sidebar-empty-state" class="hidden text-center py-6 text-xs text-on-surface-variant/60 italic">
            Aucun outil trouvé.
          </div>
        </div>

        <!-- Quick Switch Back to Home & Status Footer -->
        <div class="mt-auto pt-3 border-t border-outline-variant/15 flex flex-col gap-2">
          <a href="/" class="w-full bg-surface-container/60 hover:bg-surface-container text-on-surface border border-outline-variant/20 font-semibold py-2 px-3 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-xs group shadow-sm">
            <span class="material-symbols-outlined text-sm text-primary group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
            <span>Retour Accueil</span>
          </a>

          <div class="flex items-center justify-between px-1 text-[10px] text-on-surface-variant/60">
            <span class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Réseau Actif
            </span>
            <span class="font-medium text-[10px] text-emerald-400">Opérationnel</span>
          </div>
        </div>
      </nav>
    `;
  }

  const contextContribution =
    shellRegistry.getForBac(activeBacId) ||
    shellRegistry.getForBac(cleanBacId) ||
    shellRegistry.getForBac(`@apps/${cleanBacId}`) ||
    shellRegistry.getForBac("shell_home");

  if (!contextContribution) {
    return `<div class="p-6 text-center text-on-surface-variant text-xs italic">Contexte introuvable.</div>`;
  }

  const { context, actions } = contextContribution;
  const contextIcon =
    APP_ICONS[cleanBacId] ||
    APP_ICONS[activeBacId] ||
    (cleanBacId === "shell_home" ? "🌐" : "⚡");
  const cta = getCtaConfig(cleanBacId, context.ctaLabel);

  // Filter actions based on specific user permission requirements
  const userPerms = getUserPermissions(user);
  const permittedActions = actions.filter((action) => {
    if (!action.permission) return true;
    return userPerms.includes(action.permission);
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
          placeholder="Rechercher une option..." 
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
          <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Navigation & Outils</span>
          <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface-variant/40 text-on-surface-variant/80">${permittedActions.length}</span>
        </div>
        
        ${
          permittedActions.length > 0
            ? permittedActions
                .map((action) => {
                  const isActive = isRouteActive(action.route, currentUrl);
                  return `
            <a class="sidebar-nav-item flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 group text-xs font-medium ${isActive ? "bg-primary/15 text-primary font-semibold border border-primary/25 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 hover:translate-x-0.5 border border-transparent"}" href="${action.route}" data-search="${escapeHtml(action.label.toLowerCase())}">
              <div class="flex items-center gap-2.5 truncate">
                ${isActive ? `<span class="w-1 h-3.5 rounded-full bg-primary shrink-0"></span>` : ""}
                <span class="material-symbols-outlined text-base ${isActive ? "text-primary" : "text-primary/80"} group-hover:scale-110 transition-transform">${action.icon}</span>
                <span class="truncate">${escapeHtml(action.label)}</span>
              </div>
              ${action.badge ? `<span class="px-1.5 py-0.2 text-[9px] font-bold rounded ${action.badgeClass || "bg-primary/20 text-primary"}">${escapeHtml(action.badge)}</span>` : ""}
            </a>
          `;
                })
                .join("")
            : `
          <p class="text-xs text-on-surface-variant/60 p-2 italic">Aucune action disponible pour votre niveau d'accès.</p>
        `
        }

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
          <span class="font-medium text-[10px] text-emerald-400">Connecté</span>
        </div>
      </div>
    </nav>
  `;
}

// -----------------------------------------------------------------------------
// USER SWITCHER & CONTEXT DROPDOWN HEADER COMPONENT (PRE-PRODUCTION GRADE)
// -----------------------------------------------------------------------------
export function renderUserSwitcherWidget(
  user: UserProfile,
  activeSpace?: SpaceProfile | null,
): string {
  const userSpaces = SPACES_LIST.filter((space) => {
    if (user.role === "admin") return true;
    return space.ownerUserRole === user.role;
  });

  const displayAvatar = activeSpace ? activeSpace.avatar : user.avatar;
  const displayName = activeSpace ? activeSpace.name : user.name;
  const displayLabel = activeSpace
    ? `${activeSpace.badge} Space`
    : user.roleLabel;
  const userEmail =
    user.role === "admin"
      ? "lord.cheteck@gmail.com"
      : `${user.role}@mosaix.network`;

  return `
    <div class="relative" id="user-menu-container">
      <!-- Outer Avatar Switcher Button (Clickable & Accessible) -->
      <button 
        id="user-menu-button"
        onclick="toggleUserDropdown(event)"
        aria-expanded="false"
        aria-haspopup="true"
        class="flex items-center gap-2.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 hover:border-primary/40 p-1.5 pr-3 rounded-2xl transition-all cursor-pointer shadow-sm group focus:outline-none focus:ring-2 focus:ring-primary/40 select-none"
        title="Menu utilisateur et contexte (${escapeHtml(displayName)})"
      >
        <div class="relative shrink-0">
          <div class="w-8 h-8 rounded-xl ${activeSpace ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "bg-primary/20 text-primary border border-primary/30"} flex items-center justify-center font-bold text-sm shadow-inner">
            ${displayAvatar}
          </div>
          <!-- Real-time Presence Status Dot -->
          <span class="user-presence-dot absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-surface animate-pulse"></span>
        </div>
        
        <div class="hidden sm:flex flex-col text-left min-w-0 max-w-[120px]">
          <span class="font-bold text-xs text-on-surface leading-tight truncate">${escapeHtml(displayName)}</span>
          <span class="text-[10px] text-on-surface-variant/80 truncate mt-0.5 font-medium">${escapeHtml(displayLabel)}</span>
        </div>
        
        <span class="material-symbols-outlined text-on-surface-variant text-base group-hover:text-on-surface transition-transform duration-200">expand_more</span>
      </button>

      <!-- Pre-Production Rich User & Space Menu Dropdown / Mobile Bottom Sheet -->
      <div 
        id="user-menu-dropdown" 
        class="fixed sm:absolute inset-0 sm:inset-auto sm:right-0 sm:top-full sm:mt-2.5 z-[150] sm:z-50 hidden bg-black/60 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none items-end sm:block justify-center animate-fade-in"
        onclick="toggleUserDropdown(event)"
      >
        <div 
          class="w-full sm:w-84 max-w-lg sm:max-w-none bg-surface-container-high/98 border-t sm:border border-outline-variant/25 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-3.5 backdrop-blur-2xl space-y-3.5 select-none max-h-[88vh] sm:max-h-none overflow-y-auto no-scrollbar animate-slide-up-mobile pb-8 sm:pb-3.5"
          onclick="event.stopPropagation()"
        >
          <!-- Mobile Drag Handle -->
          <div class="bottom-sheet-handle sm:hidden"></div>

          <!-- SECTION 1: Unified Active Identity Header Card -->
        <div class="rounded-xl border border-outline-variant/15 bg-surface-variant/15 p-3 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative shrink-0">
                <div class="w-11 h-11 rounded-xl ${activeSpace ? "bg-emerald-600/20 text-emerald-400 border border-emerald-400/30" : "bg-primary/20 text-primary border border-primary/30"} flex items-center justify-center font-bold text-lg shadow-inner">
                  ${displayAvatar}
                </div>
                <span class="user-presence-dot absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-surface-container-high animate-pulse"></span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <h4 class="font-bold text-xs text-on-surface truncate">${escapeHtml(displayName)}</h4>
                  <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${activeSpace ? "bg-emerald-500/20 text-emerald-300" : "bg-primary/20 text-primary"} shrink-0">${displayLabel}</span>
                </div>
                <p class="text-[10px] text-on-surface-variant/70 font-mono truncate mt-0.5">${escapeHtml(userEmail)}</p>
              </div>
            </div>

            <!-- Quick Spaces Switcher Toggle Button -->
            ${
              userSpaces.length > 0
                ? `
              <button 
                onclick="const d = document.getElementById('usermenu-spaces-dropdown'); if(d) d.classList.toggle('hidden');" 
                title="Changer d'espace ou compte"
                class="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-variant/50 text-on-surface-variant hover:text-primary flex items-center justify-center transition border border-outline-variant/20 cursor-pointer shrink-0"
              >
                <span class="material-symbols-outlined text-base">swap_horiz</span>
              </button>
            `
                : ""
            }
          </div>

          <!-- Presence Selector Bar -->
          <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs">
            <span class="text-[10px] font-semibold text-on-surface-variant flex items-center gap-1.5">
              <span>Disponibilité :</span>
              <strong id="usermenu-presence-text" class="text-on-surface">En ligne</strong>
            </span>
            <div class="flex items-center gap-1">
              <button onclick="updatePresenceStatus('online')" title="En ligne" class="w-5 h-5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] cursor-pointer">●</button>
              <button onclick="updatePresenceStatus('busy')" title="Occupé" class="w-5 h-5 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[10px] cursor-pointer">●</button>
              <button onclick="updatePresenceStatus('away')" title="Absent" class="w-5 h-5 rounded-full bg-slate-500/20 hover:bg-slate-500/40 text-slate-300 border border-slate-500/30 flex items-center justify-center text-[10px] cursor-pointer">●</button>
              <button onclick="updatePresenceStatus('dnd')" title="Ne pas déranger" class="w-5 h-5 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 border border-rose-500/30 flex items-center justify-center text-[10px] cursor-pointer">■</button>
            </div>
          </div>

          <!-- Drawer for Spaces Switching -->
          ${
            userSpaces.length > 0
              ? `
            <div id="usermenu-spaces-dropdown" class="border-t border-outline-variant/15 pt-2 hidden animate-fade-in space-y-1.5">
              <p class="text-[9px] font-bold text-on-surface-variant/70 uppercase tracking-wider px-1">Espaces & Organisations</p>
              
              <!-- Personal Account -->
              <button onclick="switchActiveSpace('none')" class="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-variant/40 transition text-left cursor-pointer ${!activeSpace ? "bg-primary/10 border border-primary/20" : ""}">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-xs">${user.avatar}</span>
                  <div class="min-w-0">
                    <p class="text-[11px] font-bold text-on-surface truncate">${user.name}</p>
                    <p class="text-[9px] text-on-surface-variant truncate">Compte Principal</p>
                  </div>
                </div>
                ${!activeSpace ? '<span class="material-symbols-outlined text-primary text-xs font-bold">check</span>' : ""}
              </button>

              <!-- Available Spaces -->
              ${userSpaces
                .map((space) => {
                  const isCurrent = activeSpace && activeSpace.id === space.id;
                  return `
                  <button onclick="switchActiveSpace('${escapeHtml(space.id)}')" class="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-variant/40 transition text-left cursor-pointer ${isCurrent ? "bg-emerald-500/10 border border-emerald-500/20" : ""}">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-xs">${space.avatar}</span>
                      <div class="min-w-0">
                        <p class="text-[11px] font-bold text-on-surface truncate">${space.name}</p>
                        <p class="text-[9px] text-on-surface-variant truncate">${space.handle} • ${space.badge}</p>
                      </div>
                    </div>
                    ${isCurrent ? '<span class="material-symbols-outlined text-emerald-400 text-xs font-bold">check</span>' : ""}
                  </button>
                `;
                })
                .join("")}
            </div>
          `
              : ""
          }
        </div>

        <!-- SECTION 2: Core Workspace Navigation -->
        <div class="space-y-0.5 text-xs font-medium">
          <a href="/identity" class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-on-surface hover:bg-surface-variant/30 hover:text-primary transition">
            <span class="material-symbols-outlined text-base text-primary/80">account_circle</span>
            <span>Mon Profil SSO & Identité</span>
          </a>

          <a href="/spaces" class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-on-surface hover:bg-surface-variant/30 hover:text-emerald-400 transition">
            <span class="material-symbols-outlined text-base text-emerald-400/80">workspaces</span>
            <span>Espaces & Équipes</span>
          </a>

          <a href="/imperia" class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-on-surface hover:bg-surface-variant/30 hover:text-indigo-400 transition">
            <span class="material-symbols-outlined text-base text-indigo-400/80">account_balance</span>
            <span>Sénat & Gouvernance Imperia</span>
          </a>

          <a href="/identity" class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-on-surface hover:bg-surface-variant/30 hover:text-amber-400 transition">
            <span class="material-symbols-outlined text-base text-amber-400/80">shield</span>
            <span>Sécurité, Clés API & MFA</span>
          </a>
        </div>

        <div class="h-px bg-outline-variant/15"></div>

        <!-- SECTION 3: Demo Role Switcher (dev only, hidden when demo mode is off) -->
        ${
          isDemoMode()
            ? `
        <details class="group/rbac rounded-xl border border-outline-variant/15 bg-surface-variant/10 p-1">
          <summary class="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-surface-variant/30 transition text-xs font-semibold text-on-surface cursor-pointer list-none">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base">switch_account</span>
              <span>Changer de rôle (Aperçu Démo)</span>
            </div>
            <span class="material-symbols-outlined text-xs text-on-surface-variant group-open/rbac:rotate-180 transition-transform">expand_more</span>
          </summary>
          <div class="pt-2 px-1 pb-1 space-y-1">
            <p class="text-[10px] text-on-surface-variant/80 px-2 pb-1">Testez l'interface avec différents niveaux de permissions :</p>
            ${Object.values(USER_PROFILES)
              .map((profile) => {
                const isSelected = profile.role === user.role && !activeSpace;
                return `
                <button onclick="switchUserRole('${escapeHtml(profile.role)}')" class="w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface-variant/40 transition text-left cursor-pointer ${isSelected ? "bg-primary/10 border border-primary/20" : ""}">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="text-sm shrink-0">${profile.avatar}</span>
                    <div class="min-w-0">
                      <p class="text-[11px] font-bold text-on-surface leading-tight truncate">${profile.name}</p>
                      <p class="text-[9px] text-on-surface-variant/70 truncate">${profile.roleLabel}</p>
                    </div>
                  </div>
                  ${isSelected ? '<span class="material-symbols-outlined text-primary text-xs font-bold">check</span>' : ""}
                </button>
              `;
              })
              .join("")}
          </div>
        </details>
        `
            : ""
        }

        <!-- SECTION 4: Developer Tools Shortcut -->
        <div class="p-2 rounded-xl bg-surface-container/40 border border-outline-variant/10 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-sm">terminal</span>
            <span class="text-[11px] font-semibold text-on-surface">Outils Développeur</span>
          </div>
          <button onclick="openDevInspector(); toggleUserDropdown(event);" class="px-2 py-1 rounded-lg bg-surface-container-highest hover:bg-surface-variant text-[10px] font-bold text-primary transition cursor-pointer">
            Ouvrir la Console
          </button>
        </div>

        <!-- SECTION 5: Log Out Action -->
        <div class="pt-1">
          <button 
            onclick="handleLogout()" 
            class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition text-xs font-bold cursor-pointer"
          >
            <span class="material-symbols-outlined text-sm">logout</span>
            <span>Déconnexion de la Session</span>
          </button>
        </div>

        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// MOBILE DRAWER COMPONENT (SHARED ACROSS TEMPLATES)
// -----------------------------------------------------------------------------
export function renderMobileDrawer(
  userOrHtml: UserProfile | string,
  activeRoute = "/",
  activeMode = "light",
): string {
  if (typeof userOrHtml === "string") {
    return `
    <div id="mobile-drawer" class="fixed inset-0 z-[100] hidden bg-black/60 backdrop-blur-sm items-end sm:items-center justify-center transition-opacity duration-300 animate-fade-in" onclick="toggleMobileDrawer()">
      <div class="w-full max-w-lg sm:max-w-md bg-surface-container-high rounded-t-3xl sm:rounded-2xl p-5 border-t sm:border border-outline-variant/25 shadow-2xl max-h-[85vh] flex flex-col justify-between overflow-hidden animate-slide-up-mobile pb-8 sm:pb-5" onclick="event.stopPropagation()">
        <!-- Mobile Bottom Sheet Handle -->
        <div class="bottom-sheet-handle sm:hidden"></div>

        <div class="space-y-4 flex-1 flex flex-col min-h-0">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-xl">temp_preferences_custom</span>
              <span class="font-bold text-sm text-on-surface">Menu Principal</span>
            </div>
            <button onclick="toggleMobileDrawer()" class="w-8 h-8 rounded-full hover:bg-surface-variant/50 text-on-surface-variant hover:text-on-surface flex items-center justify-center transition font-bold text-base cursor-pointer">&times;</button>
          </div>
          <nav aria-label="Navigation mobile" class="space-y-2 overflow-y-auto flex-1 no-scrollbar">
            ${userOrHtml}
          </nav>
        </div>
      </div>
    </div>
    `;
  }

  const user = userOrHtml;
  const userBacs = getUserAllowedBacs(user);
  const allowedApps = apps.filter((app) => {
    const isAllowedByRole =
      userBacs.includes(app.id) ||
      userBacs.includes(app.id.replace(/^@apps\//, ""));
    if (!isAllowedByRole) return false;
    const flagKey =
      app.featureFlag || `apps.${app.id.replace(/^@apps\//, "")}.enabled`;
    return platformFeatureFlags.isEnabledSync(flagKey, true);
  });

  return `
    <div id="mobile-drawer" class="fixed inset-0 z-[100] hidden bg-black/60 backdrop-blur-sm items-end sm:items-center justify-center transition-opacity duration-300 animate-fade-in" onclick="toggleMobileDrawer()">
      <div class="w-full max-w-lg sm:max-w-md bg-surface-container-high rounded-t-3xl sm:rounded-2xl p-5 border-t sm:border border-outline-variant/25 shadow-2xl max-h-[85vh] flex flex-col justify-between overflow-hidden animate-slide-up-mobile pb-8 sm:pb-5" onclick="event.stopPropagation()">
        
        <!-- Mobile Bottom Sheet Handle -->
        <div class="bottom-sheet-handle sm:hidden"></div>

        <div class="space-y-4 flex-1 flex flex-col min-h-0">
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-xl">grid_view</span>
              <span class="font-bold text-sm text-on-surface">Modules & Applications</span>
            </div>
            <button onclick="toggleMobileDrawer()" class="w-8 h-8 rounded-full hover:bg-surface-variant/50 text-on-surface-variant hover:text-on-surface flex items-center justify-center transition font-bold text-base cursor-pointer">&times;</button>
          </div>

          <!-- Allowed BACs Navigation -->
          <div class="flex-1 overflow-y-auto no-scrollbar space-y-4">
            <div>
              <p class="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-2 px-1">Navigation Générale</p>
              <div class="grid grid-cols-2 gap-2">
                <a href="/" class="flex items-center gap-2.5 p-2.5 rounded-xl text-on-surface hover:bg-surface-variant/40 font-semibold text-xs transition ${activeRoute === "/" ? "bg-primary/10 text-primary border border-primary/20" : "bg-surface-container/60 border border-outline-variant/15"}">
                  <span class="material-symbols-outlined text-primary text-base">home</span>
                  <span class="truncate">Accueil</span>
                </a>
                <a href="/spaces" class="flex items-center gap-2.5 p-2.5 rounded-xl text-on-surface hover:bg-surface-variant/40 font-semibold text-xs transition ${activeRoute === "/spaces" ? "bg-primary/10 text-primary border border-primary/20" : "bg-surface-container/60 border border-outline-variant/15"}">
                  <span class="material-symbols-outlined text-emerald-400 text-base">workspaces</span>
                  <span class="truncate">Espaces</span>
                </a>
              </div>
            </div>

            <div>
              <p class="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-2 px-1">Toutes vos applications (${allowedApps.length})</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                ${allowedApps
                  .map((app) => {
                    const isActive =
                      activeRoute === app.route ||
                      activeRoute.startsWith(app.route + "/");
                    return `
                    <a href="${app.route}" class="flex items-center gap-3 p-2.5 rounded-xl text-on-surface hover:bg-surface-variant/40 font-semibold text-xs transition ${isActive ? "bg-primary/10 text-primary border border-primary/20" : "bg-surface-container/40 border border-outline-variant/10"}">
                      <span class="text-base shrink-0">${app.icon}</span>
                      <div class="min-w-0 flex-1">
                        <p class="truncate leading-tight">${escapeHtml(app.name)}</p>
                        <p class="text-[9px] text-on-surface-variant/70 truncate">${escapeHtml(app.category)}</p>
                      </div>
                    </a>
                  `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        </div>

        <!-- Drawer Footer: Theme Selector -->
        <div class="border-t border-outline-variant/20 pt-3 mt-auto space-y-2 bg-surface-container-high">
          <p class="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-wider px-1">Mode d'affichage</p>
          <div class="grid grid-cols-3 gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs">
            <button onclick="setTheme('light'); toggleMobileDrawer();" class="py-1.5 rounded-lg transition text-center cursor-pointer ${activeMode === "light" ? "bg-primary text-on-primary font-bold shadow" : "text-on-surface-variant hover:text-on-surface"}">Light</button>
            <button onclick="setTheme('dark'); toggleMobileDrawer();" class="py-1.5 rounded-lg transition text-center cursor-pointer ${activeMode === "dark" ? "bg-primary text-on-primary font-bold shadow" : "text-on-surface-variant hover:text-on-surface"}">Dark</button>
            <button onclick="setTheme('high-contrast'); toggleMobileDrawer();" class="py-1.5 rounded-lg transition text-center cursor-pointer ${activeMode === "high-contrast" ? "bg-primary text-on-primary font-bold shadow" : "text-on-surface-variant hover:text-on-surface"}">Contrast</button>
          </div>
        </div>

      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// MOBILE BOTTOM NAVIGATION BAR (FIXED BOTTOM BAR WITH 5 CANONICAL ACTIONS)
// -----------------------------------------------------------------------------
export function renderMobileCreateSheet(): string {
  return `
    <div id="mobile-create-sheet" class="fixed inset-0 z-[110] hidden bg-black/60 backdrop-blur-sm items-end sm:items-center justify-center transition-opacity duration-300 animate-fade-in" onclick="toggleMobileCreateSheet()">
      <div class="w-full max-w-lg sm:max-w-md bg-surface-container-high rounded-t-3xl sm:rounded-2xl p-5 border-t sm:border border-outline-variant/25 shadow-2xl max-h-[85vh] flex flex-col justify-between overflow-hidden animate-slide-up-mobile pb-8 sm:pb-5" onclick="event.stopPropagation()">
        <!-- Bottom Sheet Handle -->
        <div class="bottom-sheet-handle sm:hidden"></div>

        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                <span class="material-symbols-outlined text-lg">add_circle</span>
              </div>
              <div>
                <h3 class="font-bold text-sm text-on-surface">Création Rapide</h3>
                <p class="text-[10px] text-on-surface-variant">Sélectionnez une action à exécuter</p>
              </div>
            </div>
            <button onclick="toggleMobileCreateSheet()" class="w-8 h-8 rounded-full hover:bg-surface-variant/50 text-on-surface-variant hover:text-on-surface flex items-center justify-center transition font-bold text-base cursor-pointer">&times;</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto no-scrollbar">
            <!-- Action 1: Feed Post -->
            <button onclick="openFeedComposer()" class="flex items-center gap-3 p-3 rounded-2xl bg-surface-container hover:bg-surface-variant/40 border border-outline-variant/15 transition text-left cursor-pointer group">
              <div class="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                ✏️
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-xs text-on-surface">Publier un message</p>
                <p class="text-[10px] text-on-surface-variant/80 truncate">Partager une actualité sur le fil</p>
              </div>
            </button>

            <!-- Action 2: New Space -->
            <a href="/spaces?action=create" onclick="toggleMobileCreateSheet()" class="flex items-center gap-3 p-3 rounded-2xl bg-surface-container hover:bg-surface-variant/40 border border-outline-variant/15 transition text-left group">
              <div class="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                📁
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-xs text-on-surface">Créer un Espace</p>
                <p class="text-[10px] text-on-surface-variant/80 truncate">Nouvel atelier ou équipe</p>
              </div>
            </a>

            <!-- Action 3: New Creation Portfolio -->
            <a href="/portfolio?admin=new" onclick="toggleMobileCreateSheet()" class="flex items-center gap-3 p-3 rounded-2xl bg-surface-container hover:bg-surface-variant/40 border border-outline-variant/15 transition text-left group">
              <div class="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                🎨
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-xs text-on-surface">Ajouter une Création</p>
                <p class="text-[10px] text-on-surface-variant/80 truncate">Publier dans la galerie</p>
              </div>
            </a>

            <!-- Action 4: New Message Beam -->
            <a href="/beam?view=channels" onclick="toggleMobileCreateSheet()" class="flex items-center gap-3 p-3 rounded-2xl bg-surface-container hover:bg-surface-variant/40 border border-outline-variant/15 transition text-left group">
              <div class="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                💬
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-xs text-on-surface">Nouveau Salon</p>
                <p class="text-[10px] text-on-surface-variant/80 truncate">Canal de discussion en direct</p>
              </div>
            </a>

            <!-- Action 5: Book Slot -->
            <a href="/booking?action=book" onclick="toggleMobileCreateSheet()" class="flex items-center gap-3 p-3 rounded-2xl bg-surface-container hover:bg-surface-variant/40 border border-outline-variant/15 transition text-left group">
              <div class="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                📅
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-xs text-on-surface">Prendre Rendez-vous</p>
                <p class="text-[10px] text-on-surface-variant/80 truncate">Réserver un créneau</p>
              </div>
            </a>

            <!-- Action 6: Imperia Proposal -->
            <a href="/imperia?action=new" onclick="toggleMobileCreateSheet()" class="flex items-center gap-3 p-3 rounded-2xl bg-surface-container hover:bg-surface-variant/40 border border-outline-variant/15 transition text-left group">
              <div class="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                🏛️
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-xs text-on-surface">Proposer un Vote</p>
                <p class="text-[10px] text-on-surface-variant/80 truncate">Soumettre une consultation</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderMobileNotificationsSheet(): string {
  return `
    <div id="mobile-notifications-sheet" class="fixed inset-0 z-[110] hidden bg-black/60 backdrop-blur-sm items-end sm:items-center justify-center transition-opacity duration-300 animate-fade-in" onclick="toggleMobileNotificationsSheet()">
      <div class="w-full max-w-lg sm:max-w-md bg-surface-container-high rounded-t-3xl sm:rounded-2xl p-5 border-t sm:border border-outline-variant/25 shadow-2xl max-h-[85vh] flex flex-col justify-between overflow-hidden animate-slide-up-mobile pb-8 sm:pb-5" onclick="event.stopPropagation()">
        <!-- Bottom Sheet Handle -->
        <div class="bottom-sheet-handle sm:hidden"></div>

        <div class="space-y-4 flex-1 flex flex-col min-h-0">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <div class="relative w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                <span class="material-symbols-outlined text-lg">notifications</span>
                <span class="notification-unread-badge absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-surface animate-pulse"></span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-sm text-on-surface">Notifications</h3>
                  <span class="notification-unread-badge px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">2 nouvelles</span>
                </div>
                <p class="text-[10px] text-on-surface-variant">Activités et alertes récentes</p>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button onclick="markNotificationsAsRead()" class="px-2.5 py-1 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/10 transition cursor-pointer">
                Tout marquer lu
              </button>
              <button onclick="toggleMobileNotificationsSheet()" class="w-8 h-8 rounded-full hover:bg-surface-variant/50 text-on-surface-variant hover:text-on-surface flex items-center justify-center transition font-bold text-base cursor-pointer">&times;</button>
            </div>
          </div>

          <!-- Notification Items List -->
          <div id="notifications-list-container" class="space-y-2.5 overflow-y-auto no-scrollbar flex-1 pr-1">
            <!-- Notification 1 -->
            <a href="/beam" onclick="toggleMobileNotificationsSheet()" class="flex items-start gap-3 p-3 rounded-2xl bg-surface-container/90 hover:bg-surface-variant/50 border border-outline-variant/20 transition group">
              <div class="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-base shrink-0 mt-0.5">
                💬
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-1">
                  <p class="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">Nouveau message Beam</p>
                  <span class="text-[9px] text-on-surface-variant font-medium">Il y a 5 min</span>
                </div>
                <p class="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                  <strong class="text-on-surface font-semibold">Éléonore :</strong> « Super, l'interface est très fluide et agréable. »
                </p>
              </div>
            </a>

            <!-- Notification 2 -->
            <a href="/imperia" onclick="toggleMobileNotificationsSheet()" class="flex items-start gap-3 p-3 rounded-2xl bg-surface-container/90 hover:bg-surface-variant/50 border border-outline-variant/20 transition group">
              <div class="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-base shrink-0 mt-0.5">
                🏛️
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-1">
                  <p class="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">Consultation Citoyenne</p>
                  <span class="text-[9px] text-on-surface-variant font-medium">Il y a 25 min</span>
                </div>
                <p class="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                  Un nouveau vote sur le mode hors-ligne a été ouvert par le conseil.
                </p>
              </div>
            </a>

            <!-- Notification 3 (Read) -->
            <a href="/booking" onclick="toggleMobileNotificationsSheet()" class="flex items-start gap-3 p-3 rounded-2xl bg-surface-container/40 hover:bg-surface-variant/30 border border-outline-variant/10 transition opacity-80 group">
              <div class="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center text-base shrink-0 mt-0.5">
                📅
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-1">
                  <p class="font-bold text-xs text-on-surface">Rappel de Rendez-vous</p>
                  <span class="text-[9px] text-on-surface-variant font-medium">Hier</span>
                </div>
                <p class="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                  Votre session « Découverte Plateforme » est confirmée pour lundi 10h00.
                </p>
              </div>
            </a>
          </div>

          <!-- Empty state when cleared -->
          <div id="notifications-empty-state" class="hidden text-center py-10 space-y-2">
            <span class="material-symbols-outlined text-4xl text-primary/40">notifications_off</span>
            <p class="font-bold text-xs text-on-surface">Vous êtes à jour !</p>
            <p class="text-[10px] text-on-surface-variant">Aucune nouvelle notification pour le moment.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderMobileBottomNav(
  activeRoute: string = "/",
  user?: UserProfile,
  activeSpace?: SpaceProfile | string | null,
): string {
  const isHome = activeRoute === "/" || activeRoute === "";
  const isSpaces =
    activeRoute === "/spaces" || activeRoute.startsWith("/spaces");
  const isImperia =
    activeRoute === "/imperia" || activeRoute.startsWith("/imperia");
  const isBac = !isHome && !isSpaces && !isImperia;

  const spaceObj =
    typeof activeSpace === "string"
      ? SPACES_LIST.find((s) => s.id === activeSpace)
      : activeSpace;
  const displayAvatar = spaceObj ? spaceObj.avatar : user ? user.avatar : "👤";

  return `
    <!-- Extra Mobile Sheets -->
    ${renderMobileCreateSheet()}
    ${renderMobileNotificationsSheet()}

    <!-- Bottom Navigation Bar (5 Canonical Items) -->
    <nav 
      aria-label="Navigation mobile inférieure"
      class="mobile-bottom-nav fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-2xl border-t border-outline-variant/20 md:hidden select-none shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
    >
      <div class="flex items-center justify-between h-16 max-w-lg mx-auto px-3 relative">
        
        <!-- 1. Accueil (Home) -->
        <a 
          href="/" 
          class="min-h-[48px] min-w-[56px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 active:scale-95 ${isHome ? "text-primary font-bold" : "text-on-surface-variant/75 hover:text-on-surface"}"
          title="Accueil"
        >
          <div class="relative p-1 rounded-xl ${isHome ? "bg-primary/15 text-primary" : ""}">
            <span class="material-symbols-outlined text-2xl ${isHome ? "scale-105" : ""}">home</span>
            ${isHome ? '<span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>' : ""}
          </div>
          <span class="text-[10px] leading-none font-medium">Accueil</span>
        </a>

        <!-- 2. Modules (Applications) -->
        <button 
          onclick="toggleMobileDrawer()" 
          class="min-h-[48px] min-w-[56px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 active:scale-95 ${isBac ? "text-primary font-bold" : "text-on-surface-variant/75 hover:text-on-surface"} cursor-pointer"
          title="Ouvrir les Modules"
        >
          <div class="relative p-1 rounded-xl ${isBac ? "bg-primary/15 text-primary" : ""}">
            <span class="material-symbols-outlined text-2xl ${isBac ? "scale-105" : ""}">grid_view</span>
          </div>
          <span class="text-[10px] leading-none font-medium">Modules</span>
        </button>

        <!-- 3. Bouton Central '+' (Action FAB) -->
        <div class="flex flex-col items-center justify-center -translate-y-4">
          <button 
            onclick="toggleMobileCreateSheet()" 
            class="w-13 h-13 rounded-2xl bg-gradient-to-tr from-primary via-indigo-500 to-secondary text-surface-container-lowest flex items-center justify-center shadow-xl shadow-primary/30 border-2 border-surface active:scale-90 hover:scale-105 transition-all duration-200 cursor-pointer group"
            title="Créer une publication ou ressource"
          >
            <span class="material-symbols-outlined text-2xl font-black group-hover:rotate-90 transition-transform">add</span>
          </button>
          <span class="text-[9px] font-bold text-primary mt-1 tracking-tight">Créer</span>
        </div>

        <!-- 4. Notifications (Alertes) -->
        <button 
          onclick="toggleMobileNotificationsSheet()" 
          class="min-h-[48px] min-w-[56px] flex flex-col items-center justify-center gap-1 rounded-xl text-on-surface-variant/75 hover:text-on-surface transition-all duration-200 active:scale-95 cursor-pointer relative"
          title="Notifications & Alertes"
        >
          <div class="relative p-1 rounded-xl">
            <span class="material-symbols-outlined text-2xl">notifications</span>
            <span class="notification-unread-badge absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-surface animate-pulse">2</span>
          </div>
          <span class="text-[10px] leading-none font-medium">Alertes</span>
        </button>

        <!-- 5. Account (Profil & Espaces) -->
        <button 
          onclick="toggleUserDropdown(event)" 
          class="min-h-[48px] min-w-[56px] flex flex-col items-center justify-center gap-1 rounded-xl text-on-surface-variant/75 hover:text-on-surface transition-all duration-200 active:scale-95 cursor-pointer"
          title="Profil & Compte"
        >
          <div class="relative w-7 h-7 rounded-xl ${spaceObj ? "bg-emerald-600/20 border border-emerald-500/40 text-emerald-400" : "bg-surface-container border border-outline-variant/30 text-on-surface"} flex items-center justify-center text-xs font-bold shadow-sm">
            ${displayAvatar}
            <span class="user-presence-dot absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-surface"></span>
          </div>
          <span class="text-[10px] leading-none font-medium">Compte</span>
        </button>

      </div>
    </nav>
  `;
}

// -----------------------------------------------------------------------------
// HEADER SEARCH & DEV INSPECTOR TRIGGER CONTROLS (PRE-PRODUCTION GRADE)
// -----------------------------------------------------------------------------
export function renderHeaderSearchAndDevControls(): string {
  return `
    <!-- Quick Command Search Trigger Button (⌘K) -->
    <button 
      onclick="openCommandPalette()" 
      class="hidden sm:flex items-center gap-2.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 hover:border-primary/40 px-3 py-1.5 rounded-xl text-xs text-on-surface-variant hover:text-on-surface transition-all cursor-pointer shadow-inner group select-none" 
      title="Recherche Rapide (⌘K / Ctrl+K)"
    >
      <span class="material-symbols-outlined text-base text-primary group-hover:scale-110 transition-transform">search</span>
      <span class="font-medium">Rechercher une application, un document...</span>
      <kbd class="hidden md:inline-block px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline-variant/30 text-[10px] font-mono text-on-surface-variant font-bold shadow-sm">⌘K</kbd>
    </button>
  `;
}

// -----------------------------------------------------------------------------
// COMMAND PALETTE SPOTLIGHT MODAL (⌘K / CTRL+K)
// -----------------------------------------------------------------------------
export function renderCommandPaletteModal(): string {
  return `
    <!-- Command Palette Overlay -->
    <div id="mosaix-cmd-palette" class="fixed inset-0 z-[200] hidden bg-black/60 backdrop-blur-md items-end sm:items-start justify-center p-0 sm:p-6 md:p-20 animate-fade-in" onclick="closeCommandPalette()">
      <div class="w-full max-w-2xl bg-surface-container-high border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh] transition-all duration-200 animate-slide-up-mobile pb-6 sm:pb-0" onclick="event.stopPropagation()">
        <!-- Mobile Bottom Sheet Handle -->
        <div class="bottom-sheet-handle sm:hidden mt-3 mb-1"></div>
        
        <!-- Search Input Bar -->
        <div class="p-3.5 sm:p-4 border-b border-outline-variant/20 flex items-center gap-3 bg-surface-container">
          <span class="material-symbols-outlined text-primary text-xl">search</span>
          <input 
            type="text" 
            id="mosaix-cmd-input" 
            placeholder="Taper une commande ou chercher une application (ex: Solara, Dark, Admin, RDV)..." 
            class="w-full bg-transparent border-none text-sm font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
            oninput="filterCommandPalette(this.value)"
            onkeydown="handleCommandPaletteKeydown(event)"
          />
          <kbd class="px-2 py-1 rounded bg-surface-container-highest border border-outline-variant/30 text-[10px] font-mono text-on-surface-variant hidden sm:inline-block">ESC</kbd>
          <button onclick="closeCommandPalette()" class="sm:hidden p-1 text-on-surface-variant hover:text-on-surface text-sm font-bold">&times;</button>
        </div>

        <!-- Command Results Container -->
        <div id="mosaix-cmd-results" class="p-3 overflow-y-auto space-y-4 flex-1 divide-y divide-outline-variant/10">
          
          <!-- Category 1: Applications BAC -->
          <div class="space-y-1 pt-1">
            <p class="text-[10px] font-bold text-primary uppercase tracking-wider px-2 mb-1">Vos Applications & Outils</p>
            ${apps
              .map(
                (app) => `
              <a href="${app.route}" class="cmd-item flex items-center justify-between p-2.5 rounded-xl hover:bg-primary/10 transition group text-xs font-semibold text-on-surface">
                <div class="flex items-center gap-3">
                  <span class="text-lg p-1.5 rounded-lg bg-surface-container border border-outline-variant/20">${app.icon}</span>
                  <div>
                    <p class="font-bold text-on-surface group-hover:text-primary transition">${escapeHtml(app.name)}</p>
                    <p class="text-[10px] text-on-surface-variant">${escapeHtml(app.description || app.category)}</p>
                  </div>
                </div>
                <span class="text-[10px] text-on-surface-variant font-medium group-hover:text-primary">Ouvrir &rarr;</span>
              </a>
            `,
              )
              .join("")}
          </div>

          <!-- Category 2: Rôles & Profils Test (demo only) -->
          ${
            isDemoMode()
              ? `
          <div class="space-y-1 pt-3">
            <p class="text-[10px] font-bold text-primary uppercase tracking-wider px-2 mb-1">Changer de rôle (Aperçu Démo)</p>
            ${Object.values(USER_PROFILES)
              .map(
                (profile) => `
              <button onclick="switchUserRole('${escapeHtml(profile.role)}'); closeCommandPalette();" class="cmd-item w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-primary/10 transition group text-xs font-semibold text-on-surface text-left">
                <div class="flex items-center gap-3">
                  <span class="text-base">${profile.avatar}</span>
                  <div>
                    <p class="font-bold text-on-surface group-hover:text-primary transition">${escapeHtml(profile.name)}</p>
                    <p class="text-[10px] text-on-surface-variant">${escapeHtml(profile.roleLabel)}</p>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] bg-surface-variant/40 border border-outline-variant/20 font-medium">Tester ce profil</span>
              </button>
            `,
              )
              .join("")}
          </div>
          `
              : ""
          }

          <!-- Category 3: Actions Système & Dev Tools -->
          <div class="space-y-1 pt-3">
            <p class="text-[10px] font-bold text-primary uppercase tracking-wider px-2 mb-1">Préférences & Thèmes</p>
            
            <button onclick="setTheme('dark'); closeCommandPalette();" class="cmd-item w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-primary/10 transition group text-xs font-semibold text-on-surface text-left">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-primary text-base">dark_mode</span>
                <span>Activer le Mode Sombre</span>
              </div>
              <span class="text-[10px] text-on-surface-variant">Thème</span>
            </button>

            <button onclick="setTheme('light'); closeCommandPalette();" class="cmd-item w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-primary/10 transition group text-xs font-semibold text-on-surface text-left">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-primary text-base">light_mode</span>
                <span>Activer le Mode Clair</span>
              </div>
              <span class="text-[10px] text-on-surface-variant">Thème</span>
            </button>
          </div>

        </div>

        <!-- Footer Shortcuts Legend -->
        <div class="p-3 border-t border-outline-variant/20 bg-surface-container flex items-center justify-between text-[11px] text-on-surface-variant">
          <div class="flex items-center gap-3">
            <span><kbd class="px-1 py-0.5 rounded bg-surface-container-highest text-[9px]">↑</kbd> <kbd class="px-1 py-0.5 rounded bg-surface-container-highest text-[9px]">↓</kbd> Naviguer</span>
            <span><kbd class="px-1 py-0.5 rounded bg-surface-container-highest text-[9px]">↵</kbd> Sélectionner</span>
          </div>
          <span>MosaiX Command Palette v1.2</span>
        </div>

      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// DEVELOPER & SYSTEM INSPECTOR DRAWER (FEATURE FLAGS & BAC MATRIX)
// -----------------------------------------------------------------------------
export function renderDevInspectorDrawer(): string {
  const flagsList = Object.entries(DEFAULT_PLATFORM_FLAGS);

  return `
    <!-- Dev Inspector Drawer Overlay -->
    <div id="mosaix-dev-inspector" class="fixed inset-0 z-[200] hidden bg-black/60 backdrop-blur-sm items-end sm:justify-end animate-fade-in" onclick="closeDevInspector()">
      <div class="w-full sm:max-w-xl bg-surface-container-high border-t sm:border-l border-outline-variant/30 max-h-[90vh] sm:max-h-none sm:h-full rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-up-mobile pb-6 sm:pb-0" onclick="event.stopPropagation()">
        <!-- Mobile Bottom Sheet Handle -->
        <div class="bottom-sheet-handle sm:hidden mt-3 mb-1"></div>
        
        <!-- Drawer Header -->
        <div class="p-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container">
          <div class="flex items-center gap-2.5">
            <span class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 class="font-bold text-sm text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-lg">terminal</span>
              Inspecteur Développeur & Health Console
            </h2>
          </div>
          <button onclick="closeDevInspector()" class="p-1.5 rounded-lg hover:bg-surface-variant/40 text-on-surface-variant hover:text-on-surface transition font-bold">&times;</button>
        </div>

        <!-- Tab Controls -->
        <div class="flex items-center border-b border-outline-variant/20 bg-surface-container-low px-4 gap-2 text-xs font-semibold">
          <button onclick="switchDevTab('bacs')" id="dev-tab-btn-bacs" class="dev-tab-btn px-3 py-2.5 border-b-2 border-primary text-primary transition cursor-pointer">
            Applications (${apps.length})
          </button>
          <button onclick="switchDevTab('flags')" id="dev-tab-btn-flags" class="dev-tab-btn px-3 py-2.5 border-b-2 border-transparent text-on-surface-variant hover:text-on-surface transition cursor-pointer">
            Feature Flags (${flagsList.length})
          </button>
          <button onclick="switchDevTab('system')" id="dev-tab-btn-system" class="dev-tab-btn px-3 py-2.5 border-b-2 border-transparent text-on-surface-variant hover:text-on-surface transition cursor-pointer">
            Santé & Persistance
          </button>
        </div>

        <!-- Tab 1: BAC Bounded Contexts -->
        <div id="dev-tab-content-bacs" class="p-4 overflow-y-auto flex-1 space-y-3">
          <p class="text-[11px] text-on-surface-variant">Statut d'exécution et contrats d'interface des Bounded Contexts (BACs) :</p>
          <div class="space-y-2">
            ${apps
              .map(
                (app) => `
              <div class="p-3 rounded-xl bg-surface-container border border-outline-variant/20 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="text-xl p-1.5 rounded-lg bg-surface-container-highest">${app.icon}</span>
                  <div>
                    <h4 class="font-bold text-xs text-on-surface">${escapeHtml(app.name)}</h4>
                    <p class="text-[10px] text-on-surface-variant font-mono">${app.id} • ${app.route}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SQL Actif</span>
                  <a href="${app.route}" class="p-1 rounded hover:bg-surface-variant/40 text-primary text-xs" title="Ouvrir application">&rarr;</a>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- Tab 2: Feature Flags Switchboard -->
        <div id="dev-tab-content-flags" class="p-4 overflow-y-auto flex-1 space-y-3 hidden">
          <p class="text-[11px] text-on-surface-variant">Basculez les fonctionnalités en direct sans redémarrer le serveur :</p>
          <div class="space-y-2">
            ${flagsList
              .map(
                ([key, flag]) => `
              <div class="p-3 rounded-xl bg-surface-container border border-outline-variant/20 flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs font-bold text-on-surface truncate">${key}</span>
                    <span class="px-1.5 py-0.2 rounded text-[8px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">${flag.category}</span>
                  </div>
                  <p class="text-[10px] text-on-surface-variant mt-0.5">${escapeHtml(flag.description)}</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" ${flag.value ? "checked" : ""} onchange="toggleFeatureFlag('${key}', this.checked)" class="sr-only peer">
                  <div class="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- Tab 3: System Health & Persistence -->
        <div id="dev-tab-content-system" class="p-4 overflow-y-auto flex-1 space-y-4 hidden">
          <div class="p-4 rounded-xl bg-surface-container border border-outline-variant/20 space-y-3">
            <h3 class="font-bold text-xs text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base">database</span>
              Base de Données & Stockage SQL
            </h3>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="p-2 rounded bg-surface-container-low border border-outline-variant/10">
                <span class="text-[10px] text-on-surface-variant block">Moteur Persistant</span>
                <span class="font-bold text-emerald-400">SQLite / PostgreSQL</span>
              </div>
              <div class="p-2 rounded bg-surface-container-low border border-outline-variant/10">
                <span class="text-[10px] text-on-surface-variant block">Sécurité Webhooks</span>
                <span class="font-bold text-primary">HMAC-SHA256 Actif</span>
              </div>
              <div class="p-2 rounded bg-surface-container-low border border-outline-variant/10">
                <span class="text-[10px] text-on-surface-variant block">Challenge MFA</span>
                <span class="font-bold text-emerald-400">TOTP Intercepteur OK</span>
              </div>
              <div class="p-2 rounded bg-surface-container-low border border-outline-variant/10">
                <span class="text-[10px] text-on-surface-variant block">Identifiants Uniques</span>
                <span class="font-bold text-primary">Crypto.randomUUID</span>
              </div>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-surface-container border border-outline-variant/20 space-y-2">
            <h3 class="font-bold text-xs text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base">memory</span>
              Performance du Serveur Express/SSR
            </h3>
            <div class="text-xs text-on-surface-variant space-y-1">
              <div class="flex justify-between"><span>Port d'écoute :</span><span class="font-mono text-on-surface">3000</span></div>
              <div class="flex justify-between"><span>Architecture :</span><span class="font-mono text-on-surface">Hexagonale (Ports / Adapters)</span></div>
              <div class="flex justify-between"><span>Thème dynamique :</span><span class="font-mono text-primary">Midnight Pulse</span></div>
            </div>
          </div>
        </div>

        <!-- Drawer Footer -->
        <div class="p-3 border-t border-outline-variant/20 bg-surface-container flex items-center justify-between text-[11px] text-on-surface-variant">
          <span>MosaiX Dev Tools v1.5</span>
          <button onclick="closeDevInspector()" class="px-3 py-1 rounded-lg bg-surface-variant/40 hover:bg-surface-variant/60 text-on-surface transition font-semibold">Fermer</button>
        </div>

      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// MAINTENANCE MODE PAGE (FEAT-01)
// -----------------------------------------------------------------------------
export function renderMaintenancePage(
  reason?: string,
  estimatedDurationMinutes?: number,
): string {
  const safeReason = escapeHtml(
    reason ||
      "Maintenance programmée de la plateforme MosaiX pour optimisation et mise à niveau des services.",
  );
  const duration = estimatedDurationMinutes ?? 30;

  return `
    <div class="min-h-screen flex items-center justify-center p-6 bg-surface-container-lowest text-on-surface">
      <div class="max-w-lg w-full p-8 rounded-3xl bg-surface-container-low/90 backdrop-blur-2xl border border-amber-500/30 shadow-2xl text-center space-y-6">
        <div class="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-4xl shadow-lg shadow-amber-500/10">
          <span class="material-symbols-outlined text-4xl">engineering</span>
        </div>
        
        <div class="space-y-2">
          <span class="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/10 border border-amber-500/30 text-amber-300">
            Mode Maintenance Actif
          </span>
          <h1 class="text-2xl font-bold tracking-tight text-on-surface">Plateforme Momentanément Indisponible</h1>
          <p class="text-sm text-on-surface-variant leading-relaxed">${safeReason}</p>
        </div>

        <div class="p-4 rounded-xl bg-surface-container border border-outline-variant/20 flex items-center justify-around text-xs">
          <div>
            <span class="text-on-surface-variant block text-[10px] uppercase">Durée estimée</span>
            <span class="font-bold text-amber-400 font-mono text-sm">~ ${duration} min</span>
          </div>
          <div class="w-px h-8 bg-outline-variant/20"></div>
          <div>
            <span class="text-on-surface-variant block text-[10px] uppercase">Statut Services</span>
            <span class="font-bold text-emerald-400 font-mono text-sm">Sécurisés</span>
          </div>
        </div>

        <div class="text-xs text-on-surface-variant/80 space-y-3">
          <p>Les administrateurs peuvent se connecter avec leurs identifiants de gouvernance ou utiliser les en-têtes d'authentification privilégiés.</p>
          <div class="flex items-center justify-center gap-3 pt-2">
            <a href="/identity" class="px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold transition">
              Connexion Administrateur
            </a>
            <button onclick="window.location.reload()" class="px-4 py-2 rounded-xl bg-surface-variant/40 hover:bg-surface-variant/60 text-on-surface text-xs font-semibold transition">
              Actualiser
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// TOAST NOTIFICATION CONTAINER & CLIENT JS
// -----------------------------------------------------------------------------
export function renderToastContainer(): string {
  return `
    <div id="mosaix-toast-container" class="fixed top-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none"></div>
  `;
}

export function renderBacAdminSafely(
  appId: string,
  contributions: unknown[] = [],
): string {
  const cleanId = (appId || "").replace(/^@apps\//, "");
  const icon = APP_ICONS[cleanId] || APP_ICONS[appId] || "📦";
  const title = cleanId.charAt(0).toUpperCase() + cleanId.slice(1);

  return `
    <div class="space-y-6 max-w-4xl mx-auto">
      <div class="p-6 rounded-3xl bg-surface-container/60 border border-outline-variant/20 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-3xl shadow-inner">
            ${icon}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold text-on-surface">${escapeHtml(title)}</h2>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                En ligne
              </span>
            </div>
            <p class="text-xs text-on-surface-variant mt-1">Espace applicatif prêt à l'emploi et synchronisé avec vos équipes.</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <a href="/" class="px-4 py-2 rounded-xl bg-surface-container-highest hover:bg-surface-variant text-xs font-bold text-on-surface transition">
            Retour Accueil
          </a>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/15 space-y-2">
          <div class="flex items-center gap-2 text-primary text-xs font-bold">
            <span class="material-symbols-outlined text-base">verified_user</span>
            <span>Accès Sécurisé</span>
          </div>
          <p class="text-xs text-on-surface-variant/90 leading-relaxed">Vos données sont protégées et isolées selon vos droits d'accès.</p>
        </div>

        <div class="p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/15 space-y-2">
          <div class="flex items-center gap-2 text-emerald-400 text-xs font-bold">
            <span class="material-symbols-outlined text-base">sync</span>
            <span>Synchronisation Directe</span>
          </div>
          <p class="text-xs text-on-surface-variant/90 leading-relaxed">Les modifications sont synchronisées en continu avec vos collaborateurs.</p>
        </div>

        <div class="p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/15 space-y-2">
          <div class="flex items-center gap-2 text-indigo-400 text-xs font-bold">
            <span class="material-symbols-outlined text-base">widgets</span>
            <span>Outils Intégrés</span>
          </div>
          <p class="text-xs text-on-surface-variant/90 leading-relaxed">Retrouvez toutes les actions de ce module dans la barre latérale.</p>
        </div>
      </div>
    </div>
  `;
}

export {
  renderShellToastContainer,
  renderShellConfirmModal,
} from "./client/shell-client-scripts.js";
export { getActiveUserProfile } from "./profiles.js";
