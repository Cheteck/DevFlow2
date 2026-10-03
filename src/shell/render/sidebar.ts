import { type BacDescriptor } from "@mosaix/core";
import { apps } from "../discovery.js";
import { apps } from "../discovery.js";
import { platformFeatureFlags } from "../feature-flags.js";
import {
  SPACES_LIST,
  USER_PROFILES,
  type SpaceProfile,
  type UserProfile,
} from "../profiles.js";

function getUserAllowedBacs(user?: UserProfile): string[] {
  if (!user || !user.role) {
    return apps.map((app) => app.id);
  }
  const matchedProfile = Object.values(USER_PROFILES).find((p) => p.role === user.role);
  if (matchedProfile && matchedProfile.allowedBacs) {
    return matchedProfile.allowedBacs;
  }
  return apps.map((app) => app.id);
}

function getUserPermissions(user?: UserProfile): string[] {
  if (!user || !user.role) return [];
  const matchedProfile = Object.values(USER_PROFILES).find((p) => p.role === user.role);
  return matchedProfile?.permissions || [];
}

export function renderPrimarySidebar(
  user: UserProfile,
  activeRoute: string,
  activeSpace?: SpaceProfile | string | null,
): string {
  if (typeof activeSpace === "string") {
    activeSpace = SPACES_LIST.find((s) => s.id === activeSpace) ?? null;
  }
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

  const displayName = user?.name || "Invité MosaiX";
  const displayRole = user?.roleLabel || user?.role || "Membre";
  const displayAvatar = user?.avatar || "👤";

  return `
    <nav id="mosaix-primary-sidebar" class="primary-sidebar fixed left-0 top-0 h-full w-[72px] bg-surface-container-low/90 backdrop-blur-2xl border-r border-outline-variant/20 flex flex-col items-center py-4 z-50 select-none shadow-xl transition-all duration-300">
      <!-- App Brand Logo / Identity Mark -->
      <a href="/" class="group relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-300 mb-6" title="MosaiX Home">
        <span class="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform duration-300">grid_view</span>
        <span class="absolute -bottom-1 -right-1 flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-surface-container-low"></span>
        </span>
      </a>

      <!-- Space Switcher Trigger -->
      <div class="relative mb-4 group px-2 w-full flex justify-center">
        <button onclick="toggleSpaceMenu()" title="Changer d'espace ou organisation" class="w-11 h-11 rounded-2xl bg-surface-container-high/60 border border-outline-variant/30 hover:bg-surface-variant flex items-center justify-center text-lg transition-all duration-200 cursor-pointer hover:border-primary/40 relative">
          <span>${activeSpace ? activeSpace.icon : "🌐"}</span>
          <span class="material-symbols-outlined text-[10px] text-on-surface-variant absolute bottom-0.5 right-0.5">unfold_more</span>
        </button>

        <!-- Tooltip -->
        <div class="absolute left-[76px] top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-outline-variant/30 flex items-center gap-1.5">
          <span>${activeSpace ? activeSpace.name : "Tous les Espaces"}</span>
          <kbd class="px-1 py-0.2 rounded bg-surface-variant text-[9px] text-on-surface-variant">⌥S</kbd>
        </div>
      </div>

      <div class="w-8 h-[1px] bg-outline-variant/20 my-1"></div>

      <!-- Scrollable Primary BAC App Icons -->
      <div class="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto no-scrollbar py-2 px-2">
        ${allowedApps
          .map((app) => {
            const isActive =
              activeRoute === app.route ||
              activeRoute.startsWith(app.route + "/");
            const isBeam = app.id === "@apps/beam" || app.id === "beam";
            return `
            <div class="relative group w-full flex justify-center">
              <a href="${app.route}"
                 class="relative w-11 h-11 rounded-2xl flex items-center justify-center text-xl transition-all duration-300 ${
                   isActive
                     ? "bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105 font-bold"
                     : "bg-surface-container/50 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface hover:scale-105"
                 }">
                <span>${app.icon}</span>
                ${
                  isActive
                    ? `<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full -ml-[12px] shadow-sm"></span>`
                    : ""
                }
                ${
                  isBeam
                    ? `<span class="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white border-2 border-surface-container-low shadow-sm">3</span>`
                    : ""
                }
              </a>

              <!-- App Tooltip -->
              <div class="absolute left-[76px] top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-outline-variant/30 flex items-center gap-2">
                <span>${app.name}</span>
                <span class="text-[10px] text-on-surface-variant font-mono font-normal">v${
                  app.version
                }</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>

      <!-- Bottom System Controls -->
      <div class="mt-auto flex flex-col items-center gap-3 w-full pt-2 px-2">
        <!-- Quick Action Trigger (Plus menu) -->
        <div class="relative group w-full flex justify-center">
          <button onclick="toggleQuickCreateModal()" title="Créer une ressource" class="w-11 h-11 rounded-2xl bg-surface-container-high/80 hover:bg-primary/20 hover:text-primary border border-outline-variant/30 flex items-center justify-center text-on-surface-variant transition-all duration-200 cursor-pointer">
            <span class="material-symbols-outlined text-xl">add</span>
          </button>
          <div class="absolute left-[76px] top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-outline-variant/30">
            Créer rapidement...
          </div>
        </div>

        <!-- Dev Inspector Toggle -->
        <div class="relative group w-full flex justify-center">
          <button onclick="toggleDevInspector()" title="Dev Tools & Inspection" class="w-11 h-11 rounded-2xl bg-surface-container-high/50 hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-all duration-200 cursor-pointer">
            <span class="material-symbols-outlined text-lg">bug_report</span>
          </button>
          <div class="absolute left-[76px] top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-outline-variant/30 flex items-center gap-1.5">
            <span>Dev Tools</span>
            <kbd class="px-1 py-0.2 rounded bg-surface-variant text-[9px] text-on-surface-variant">⌘I</kbd>
          </div>
        </div>

        <div class="w-8 h-[1px] bg-outline-variant/20 my-1"></div>

        <!-- Synchronized User Profile Avatar (Triggers Profile Menu) -->
        <div class="relative group w-full flex justify-center">
          <button onclick="toggleUserMenu()" title="Profil & Compte (${displayName})" class="w-11 h-11 rounded-2xl bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center text-lg hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer relative overflow-hidden shadow-sm">
            <span>${displayAvatar}</span>
            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface-container-low"></span>
          </button>
          <div class="absolute left-[76px] top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-outline-variant/30 flex flex-col gap-0.5">
            <span class="font-bold text-on-surface">${displayName}</span>
            <span class="text-[10px] text-primary">${displayRole}</span>
          </div>
        </div>
      </div>
    </nav>
  `;
}

function isRouteActive(actionRoute: string, currentUrl: string): boolean {
  if (actionRoute === "/" && currentUrl === "/") return true;
  if (actionRoute !== "/" && currentUrl.startsWith(actionRoute)) return true;
  return false;
}

function getCtaConfig(bacId: string, customLabel?: string) {
  const configs: Record<
    string,
    { label: string; icon: string; action: string }
  > = {
    solara: {
      label: customLabel || "Publier un message",
      icon: "bolt",
      action: "const c = document.getElementById('composer-text'); if(c){ c.focus(); }",
    },
    commerce: {
      label: customLabel || "Créer un produit",
      icon: "add_shopping_cart",
      action: "window.location.href='/commerce/products/new'",
    },
    booking: {
      label: customLabel || "Réserver un créneau",
      icon: "calendar_add_on",
      action: "window.location.href='/booking/new'",
    },
    beam: {
      label: customLabel || "Nouvelle discussion",
      icon: "edit_square",
      action: "window.location.href='/beam/new'",
    },
    portfolio: {
      label: customLabel || "Ajouter un vendable",
      icon: "post_add",
      action: "window.location.href='/portfolio/new'",
    },
    solidarity: {
      label: customLabel || "Lancer un appel",
      icon: "campaign",
      action: "window.location.href='/solidarity/new'",
    },
    spaces: {
      label: customLabel || "Créer un espace",
      icon: "create_new_folder",
      action: "window.location.href='/spaces/new'",
    },
  };

  return (
    configs[bacId] || {
      label: customLabel || "Nouvelle Action",
      icon: "add_circle",
      action: "toggleQuickCreateModal()",
    }
  );
}

export function renderSecondarySidebar(context: {
  activeAppId: string;
  activeRoute: string;
  currentUser?: UserProfile;
  bacDescriptor?: BacDescriptor;
  defaultBacId?: string;
}): string {
  const cleanAppId = context.activeAppId.replace(/^@apps\//, "");
  const currentApp = apps.find(
    (a) =>
      a.id === context.activeAppId ||
      a.id.replace(/^@apps\//, "") === cleanAppId,
  );
  const isDefaultBac =
    context.defaultBacId &&
    (context.activeAppId === context.defaultBacId ||
      cleanAppId === context.defaultBacId.replace(/^@apps\//, ""));

  const userPerms = getUserPermissions(context.currentUser);

  const rawActions = context.bacDescriptor?.actionItems || [];
  const allowedActions = rawActions.filter((action) => {
    if (!action.requiredPermission) return true;
    return (
      userPerms.includes(action.requiredPermission) ||
      userPerms.includes("*") ||
      context.currentUser?.role === "admin"
    );
  });

  const cta = getCtaConfig(
    cleanAppId,
    context.bacDescriptor?.primaryCta?.label,
  );

  return `
    <nav id="mosaix-secondary-sidebar" class="secondary-sidebar hidden lg:flex flex-col w-64 shrink-0 bg-surface-container-low/80 fixed left-[72px] top-0 h-full border-r border-outline-variant/20 backdrop-blur-2xl py-5 px-3.5 gap-4 z-40 transition-all duration-300 select-none shadow-2xl">
      <!-- Context Header -->
      <div class="flex items-center justify-between pb-3.5 border-b border-outline-variant/15">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-surface-container-high/90 border border-outline-variant/30 flex items-center justify-center text-lg shrink-0 shadow-inner">
            ${currentApp ? currentApp.icon : "⚡"}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <h1 class="font-bold text-sm text-on-surface tracking-tight truncate">${
                context.bacDescriptor?.displayName ||
                currentApp?.name ||
                "Accueil MosaiX"
              }</h1>
              <span class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
                ${isDefaultBac ? "BAC Défaut" : "Actif"}
              </span>
            </div>
            <p class="text-[11px] text-primary/90 font-medium truncate mt-0.5">${
              context.bacDescriptor?.tagline ||
              currentApp?.description ||
              "Module connecté"
            }</p>
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
          <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface-variant/40 text-on-surface-variant/80">${
            allowedActions.length
          }</span>
        </div>

        ${
          allowedActions.length > 0
            ? allowedActions
                .map((action) => {
                  const active = isRouteActive(
                    action.route,
                    context.activeRoute,
                  );
                  return `
                <a href="${action.route}" class="sidebar-action-item flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                  active
                    ? "bg-primary/15 text-primary font-bold shadow-sm border border-primary/20"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50"
                }">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="material-symbols-outlined text-lg ${
                      active ? "text-primary" : "text-on-surface-variant/70"
                    }">${action.icon}</span>
                    <span class="truncate">${action.label}</span>
                  </div>
                  ${
                    action.badge
                      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">${action.badge}</span>`
                      : ""
                  }
                </a>
              `;
                })
                .join("")
            : `<p class="text-xs text-on-surface-variant/60 p-2 italic">Aucune action disponible pour votre niveau d'accès.</p>`
        }

        <div id="secondary-sidebar-empty-state" class="hidden text-center py-6 text-xs text-on-surface-variant/60 italic">
          Aucun résultat pour cette recherche.
        </div>
      </div>

      <!-- Context Call to Action & Space Indicator -->
      <div class="mt-auto pt-3 border-t border-outline-variant/15 flex flex-col gap-2">
        <button onclick="${
          cta.action
        }" class="w-full bg-primary hover:bg-primary/90 text-on-primary font-bold py-2.5 px-4 rounded-xl transition-all duration-200 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs border border-primary/30">
          <span class="material-symbols-outlined text-sm">${cta.icon}</span>
          <span>${cta.label}</span>
        </button>

        <div class="flex items-center justify-between px-1 text-[10px] text-on-surface-variant/60">
          <span class="flex items-center gap-1.5 truncate">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
            <span class="truncate">Réseau Principal</span>
          </span>
          <span class="font-medium text-[10px] text-emerald-400">Connecté</span>
        </div>
      </div>
    </nav>
  `;
}
