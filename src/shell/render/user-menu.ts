import { USER_PROFILES, type UserProfile } from "../profiles.js";

export function renderUserSwitcherWidget(user?: UserProfile): string {
  const currentRole = user?.role || "guest";
  const currentName = user?.name || "Invité MosaiX";
  const currentAvatar = user?.avatar || "👤";
  const currentRoleLabel = user?.roleLabel || "Visiteur Sans Session";

  return `
    <div class="relative" id="user-switcher-container">
      <button
        onclick="toggleUserMenu()"
        class="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-surface-container-high/60 hover:bg-surface-variant border border-outline-variant/30 transition-all cursor-pointer select-none group"
        title="Changer d'utilisateur / rôle (Aperçu Démo)"
        aria-label="Changer de profil ou rôle de démonstration"
      >
        <div class="w-8 h-8 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-sm font-bold shadow-inner group-hover:scale-105 transition-transform">
          ${currentAvatar}
        </div>
        <div class="text-left hidden sm:block min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-xs text-on-surface truncate max-w-[100px]">${currentName}</span>
            <span class="material-symbols-outlined text-[14px] text-on-surface-variant group-hover:text-primary transition-colors">expand_more</span>
          </div>
          <span class="text-[10px] text-primary font-semibold block -mt-0.5 truncate max-w-[100px]">${currentRoleLabel}</span>
        </div>
      </button>

      <!-- User Switcher Dropdown Menu -->
      <div
        id="user-menu-dropdown"
        class="hidden absolute right-0 top-12 w-72 bg-surface-container-high/95 backdrop-blur-2xl border border-outline-variant/30 rounded-2xl shadow-2xl z-50 p-3 flex flex-col gap-2 transition-all duration-200"
      >
        <div class="px-2 py-1.5 border-b border-outline-variant/20 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-on-surface">Activer un profil de test</p>
            <p class="text-[10px] text-on-surface-variant">Simulez les rôles RBAC en direct</p>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/20 text-primary uppercase tracking-wider">Aperçu Démo</span>
        </div>

        <div class="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
          ${Object.values(USER_PROFILES).map((profile) => {
            const isSelected = profile.role === currentRole;
            return `
              <button
                onclick="switchUserRole('${profile.role}')"
                class="flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                  isSelected
                    ? "bg-primary/15 border border-primary/30 text-on-surface font-bold"
                    : "hover:bg-surface-variant/60 text-on-surface-variant hover:text-on-surface"
                }"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="text-lg p-1 rounded-lg bg-surface-container border border-outline-variant/20">${
                    profile.avatar
                  }</span>
                  <div class="min-w-0">
                    <p class="text-xs font-bold truncate ${
                      isSelected ? "text-primary" : "text-on-surface"
                    }">${profile.name}</p>
                    <p class="text-[10px] text-on-surface-variant truncate">${
                      profile.roleLabel
                    }</p>
                  </div>
                </div>
                ${
                  isSelected
                    ? `<span class="material-symbols-outlined text-primary text-base">check_circle</span>`
                    : `<span class="text-[10px] text-on-surface-variant/60 font-medium group-hover:text-primary">Choisir</span>`
                }
              </button>
            `;
          }).join("")}
        </div>

        <div class="pt-2 border-t border-outline-variant/20 flex items-center justify-between px-2 text-[10px] text-on-surface-variant">
          <span>Persistance automatique</span>
          <a href="/citadelle" class="text-primary font-bold hover:underline">Gérer IAM &rarr;</a>
        </div>
      </div>
    </div>
  `;
}
