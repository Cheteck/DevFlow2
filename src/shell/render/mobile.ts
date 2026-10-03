import { } from "@mosaix/core";
import { apps } from "../discovery.js";
import { platformFeatureFlags } from "../feature-flags.js";
import { USER_PROFILES, type UserProfile } from "../profiles.js";

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

export function renderMobileDrawer(
  activeAppId: string,
  user?: UserProfile,
  defaultBacId?: string,
): string {
  const cleanActiveId = activeAppId.replace(/^@apps\//, "");
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
    <!-- Backdrop Overlay -->
    <div
      id="mobile-drawer-backdrop"
      onclick="closeMobileDrawer()"
      class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 lg:hidden"
      aria-hidden="true"
    ></div>

    <!-- Mobile Drawer Panel -->
    <aside
      id="mobile-drawer"
      class="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-surface-container-high/95 backdrop-blur-2xl border-r border-outline-variant/30 z-50 transform -translate-x-full transition-transform duration-300 ease-out flex flex-col p-5 gap-5 shadow-2xl lg:hidden select-none"
      aria-label="Menu principal mobile"
    >
      <!-- Header with Brand & Close -->
      <div class="flex items-center justify-between pb-4 border-b border-outline-variant/20">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-primary-container text-on-primary flex items-center justify-center font-bold text-xl shadow-lg shadow-primary/30">
            M
          </div>
          <div>
            <h2 class="font-bold text-base text-on-surface tracking-tight">Plateforme MosaiX</h2>
            <p class="text-[11px] text-primary font-medium">Navigation &amp; Ecosystème</p>
          </div>
        </div>
        <button
          onclick="closeMobileDrawer()"
          class="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60 transition cursor-pointer"
          aria-label="Fermer le menu mobile"
        >
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      <!-- Quick Profile Card inside Drawer -->
      <div class="p-3.5 rounded-2xl bg-surface-container/80 border border-outline-variant/20 flex items-center justify-between shadow-inner">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-lg font-bold">
            ${user?.avatar || "👤"}
          </div>
          <div>
            <p class="font-bold text-xs text-on-surface truncate max-w-[140px]">${
              user?.name || "Invité MosaiX"
            }</p>
            <p class="text-[10px] text-primary font-semibold truncate max-w-[140px]">${
              user?.roleLabel || "Visiteur Sans Session"
            }</p>
          </div>
        </div>
        <button onclick="switchUserRole('admin')" title="Basculer vers Administrateur" class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition">
          Changer
        </button>
      </div>

      <!-- Scrollable Apps Grid inside Mobile Drawer -->
      <div class="flex-1 overflow-y-auto pr-1 space-y-2">
        <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Applications Disponibles</p>
        <div class="grid grid-cols-1 gap-1.5">
          ${allowedApps
            .map((app) => {
              const appClean = app.id.replace(/^@apps\//, "");
              const isActive = cleanActiveId === appClean;
              const isDefault =
                defaultBacId &&
                appClean === defaultBacId.replace(/^@apps\//, "");
              return `
              <a
                href="${app.route}"
                onclick="closeMobileDrawer()"
                class="flex items-center justify-between p-3 rounded-2xl transition-all ${
                  isActive
                    ? "bg-primary text-on-primary font-bold shadow-md shadow-primary/25"
                    : "bg-surface-container/50 hover:bg-surface-variant text-on-surface-variant hover:text-on-surface"
                }"
              >
                <div class="flex items-center gap-3">
                  <span class="text-xl p-1.5 rounded-xl bg-surface-container-low/60 border border-outline-variant/20">${
                    app.icon
                  }</span>
                  <div>
                    <p class="text-xs font-bold leading-tight ${
                      isActive ? "text-on-primary" : "text-on-surface"
                    }">${app.name}</p>
                    <p class="text-[10px] ${
                      isActive ? "text-on-primary/80" : "text-on-surface-variant"
                    } line-clamp-1">${app.description}</p>
                  </div>
                </div>
                ${
                  isDefault
                    ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }">Défaut</span>`
                    : ""
                }
              </a>
            `;
            })
            .join("")}
        </div>
      </div>

      <!-- Footer Controls in Mobile Drawer -->
      <div class="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
        <button onclick="toggleDevInspector(); closeMobileDrawer();" class="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-variant transition font-medium">
          <span class="material-symbols-outlined text-base">bug_report</span>
          <span>Dev Tools</span>
        </button>
        <span class="text-[10px] font-mono">v1.0.0-PROD</span>
      </div>
    </aside>
  `;
}

export function renderMobileCreateSheet(): string {
  return `
    <div
      id="mobile-create-backdrop"
      onclick="closeMobileCreateSheet()"
      class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 lg:hidden"
      aria-hidden="true"
    ></div>

    <div
      id="mobile-create-sheet"
      class="fixed bottom-0 left-0 right-0 bg-surface-container-high/95 backdrop-blur-2xl border-t border-outline-variant/30 rounded-t-3xl z-50 transform translate-y-full transition-transform duration-300 ease-out p-6 flex flex-col gap-4 shadow-2xl lg:hidden max-h-[85vh] overflow-y-auto"
      aria-label="Menu de création rapide"
    >
      <div class="w-12 h-1.5 bg-outline-variant/40 rounded-full mx-auto -mt-2 mb-1"></div>

      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div>
          <h3 class="font-bold text-base text-on-surface">Créer une ressource</h3>
          <p class="text-xs text-on-surface-variant">Sélectionnez le type de contenu à générer</p>
        </div>
        <button onclick="closeMobileCreateSheet()" class="p-2 rounded-xl text-on-surface-variant hover:text-on-surface transition">
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-2">
        <button onclick="closeMobileCreateSheet(); const c = document.getElementById('composer-text'); if(c){ c.focus(); }" class="flex flex-col items-start gap-2 p-4 rounded-2xl bg-surface-container/80 hover:bg-primary/10 border border-outline-variant/20 hover:border-primary/30 transition text-left group cursor-pointer">
          <span class="p-2.5 rounded-xl bg-primary/15 text-primary material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">bolt</span>
          <div>
            <p class="font-bold text-xs text-on-surface group-hover:text-primary transition">Message Solara</p>
            <p class="text-[10px] text-on-surface-variant mt-0.5">Flux social &amp; discussions</p>
          </div>
        </button>

        <a href="/commerce/products/new" onclick="closeMobileCreateSheet()" class="flex flex-col items-start gap-2 p-4 rounded-2xl bg-surface-container/80 hover:bg-primary/10 border border-outline-variant/20 hover:border-primary/30 transition text-left group cursor-pointer">
          <span class="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">add_shopping_cart</span>
          <div>
            <p class="font-bold text-xs text-on-surface group-hover:text-primary transition">Produit Vendable</p>
            <p class="text-[10px] text-on-surface-variant mt-0.5">Marketplace &amp; Catalogue</p>
          </div>
        </a>

        <a href="/booking/new" onclick="closeMobileCreateSheet()" class="flex flex-col items-start gap-2 p-4 rounded-2xl bg-surface-container/80 hover:bg-primary/10 border border-outline-variant/20 hover:border-primary/30 transition text-left group cursor-pointer">
          <span class="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">calendar_add_on</span>
          <div>
            <p class="font-bold text-xs text-on-surface group-hover:text-primary transition">Réservation / RDV</p>
            <p class="text-[10px] text-on-surface-variant mt-0.5">Services &amp; Créneaux</p>
          </div>
        </a>

        <a href="/solidarity/new" onclick="closeMobileCreateSheet()" class="flex flex-col items-start gap-2 p-4 rounded-2xl bg-surface-container/80 hover:bg-primary/10 border border-outline-variant/20 hover:border-primary/30 transition text-left group cursor-pointer">
          <span class="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">campaign</span>
          <div>
            <p class="font-bold text-xs text-on-surface group-hover:text-primary transition">Appel Solidarité</p>
            <p class="text-[10px] text-on-surface-variant mt-0.5">Besoins &amp; Crises</p>
          </div>
        </a>
      </div>
    </div>
  `;
}

export function renderMobileNotificationsSheet(): string {
  return `
    <div
      id="mobile-notif-backdrop"
      onclick="closeMobileNotifSheet()"
      class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 lg:hidden"
      aria-hidden="true"
    ></div>

    <div
      id="mobile-notif-sheet"
      class="fixed bottom-0 left-0 right-0 bg-surface-container-high/95 backdrop-blur-2xl border-t border-outline-variant/30 rounded-t-3xl z-50 transform translate-y-full transition-transform duration-300 ease-out p-6 flex flex-col gap-4 shadow-2xl lg:hidden max-h-[85vh] overflow-y-auto"
      aria-label="Centre de notifications mobile"
    >
      <div class="w-12 h-1.5 bg-outline-variant/40 rounded-full mx-auto -mt-2 mb-1"></div>

      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-base text-on-surface">Notifications &amp; Alertes</h3>
          <span id="mosaix-mobile-notification-unread-badge" class="mosaix-mobile-notification-unread-badge px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">2 nouvelles</span>
        </div>
        <button onclick="closeMobileNotifSheet()" class="p-2 rounded-xl text-on-surface-variant hover:text-on-surface transition">
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      <div class="flex flex-col gap-2 pt-1">
        <p class="text-[10px] text-on-surface-variant">Activités et alertes récentes</p>

        <!-- Notification Item 1 -->
        <a href="/beam" onclick="closeMobileNotifSheet()" class="flex items-start gap-3 p-3 rounded-2xl bg-surface-container/80 hover:bg-primary/10 border border-outline-variant/20 transition group">
          <span class="p-2 rounded-xl bg-primary/20 text-primary material-symbols-outlined text-lg shrink-0 mt-0.5">chat</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">Nouveau message Beam</p>
              <span class="text-[9px] text-on-surface-variant font-medium">Il y a 5 min</span>
            </div>
            <p class="text-[11px] text-on-surface-variant line-clamp-2 mt-0.5">
              <strong class="text-on-surface font-semibold">Éléonore :</strong> « Super, l'interface est très fluide et agréable. »
            </p>
          </div>
        </a>

        <!-- Notification Item 2 -->
        <a href="/solara" onclick="closeMobileNotifSheet()" class="flex items-start gap-3 p-3 rounded-2xl bg-surface-container/80 hover:bg-primary/10 border border-outline-variant/20 transition group">
          <span class="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 material-symbols-outlined text-lg shrink-0 mt-0.5">poll</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">Consultation Citoyenne</p>
              <span class="text-[9px] text-on-surface-variant font-medium">Il y a 25 min</span>
            </div>
            <p class="text-[11px] text-on-surface-variant line-clamp-2 mt-0.5">
              Votre vote a bien été comptabilisé sur Solara.
            </p>
          </div>
        </a>

        <!-- Notification Item 3 -->
        <a href="/booking" onclick="closeMobileNotifSheet()" class="flex items-start gap-3 p-3 rounded-2xl bg-surface-container/80 hover:bg-primary/10 border border-outline-variant/20 transition group">
          <span class="p-2 rounded-xl bg-amber-500/20 text-amber-400 material-symbols-outlined text-lg shrink-0 mt-0.5">event</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="font-bold text-xs text-on-surface">Rappel de Rendez-vous</p>
              <span class="text-[9px] text-on-surface-variant font-medium">Demain 10:00</span>
            </div>
            <p class="text-[11px] text-on-surface-variant line-clamp-2 mt-0.5">
              Session de conseil programmée avec le Space "Tech Innovation".
            </p>
          </div>
        </a>
      </div>

      <div class="pt-2 border-t border-outline-variant/20 text-center">
        <button onclick="closeMobileNotifSheet()" class="text-xs text-primary font-bold hover:underline">
          Tout marquer comme lu
        </button>
      </div>
    </div>
  `;
}

export function renderMobileBottomNav(activeAppId: string): string {
  const cleanActive = activeAppId.replace(/^@apps\//, "");

  return `
    <nav class="fixed bottom-0 left-0 right-0 h-16 bg-surface-container-low/95 backdrop-blur-2xl border-t border-outline-variant/20 flex items-center justify-around px-2 z-40 lg:hidden shadow-2xl select-none" aria-label="Navigation mobile inférieure">

      <!-- Button 1: Menu Drawer Trigger -->
      <button
        onclick="toggleMobileDrawer()"
        class="flex flex-col items-center justify-center w-14 h-12 rounded-2xl text-on-surface-variant hover:text-primary transition cursor-pointer"
        title="Ouvrir les Modules"
      >
        <span class="material-symbols-outlined text-2xl">grid_view</span>
        <span class="text-[9px] font-bold mt-0.5">Modules</span>
      </button>

      <!-- Button 2: Quick Search (⌘K / Palette) -->
      <button
        onclick="toggleCommandPalette()"
        class="flex flex-col items-center justify-center w-14 h-12 rounded-2xl text-on-surface-variant hover:text-primary transition cursor-pointer"
        title="Rechercher"
      >
        <span class="material-symbols-outlined text-2xl">search</span>
        <span class="text-[9px] font-bold mt-0.5">Chercher</span>
      </button>

      <!-- Button 3: Floating Action Create Button (Center Highlight) -->
      <button
        onclick="toggleMobileCreateSheet()"
        class="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-primary-container text-on-primary shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform cursor-pointer -mt-5 border-2 border-surface-container-low"
        title="Créer une publication ou ressource"
      >
        <span class="material-symbols-outlined text-2xl">add</span>
        <span class="sr-only">Créer</span>
      </button>

      <!-- Button 4: Mobile Notifications -->
      <button
        onclick="toggleMobileNotifSheet()"
        class="flex flex-col items-center justify-center w-14 h-12 rounded-2xl text-on-surface-variant hover:text-primary transition cursor-pointer relative"
        title="Notifications &amp; Alertes"
      >
        <span class="material-symbols-outlined text-2xl">notifications</span>
        <span class="absolute top-1 right-3 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
        <span class="text-[9px] font-bold mt-0.5">Alertes</span>
      </button>

      <!-- Button 5: User Profile & Role Switcher -->
      <button
        onclick="toggleUserMenu()"
        class="flex flex-col items-center justify-center w-14 h-12 rounded-2xl text-on-surface-variant hover:text-primary transition cursor-pointer"
        title="Profil &amp; Compte"
      >
        <span class="material-symbols-outlined text-2xl">person</span>
        <span class="text-[9px] font-bold mt-0.5">${
          cleanActive ? cleanActive.substring(0, 8) : "Profil"
        }</span>
      </button>

    </nav>
  `;
}
