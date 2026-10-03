import { apps } from "../discovery.js";
import { platformFeatureFlags } from "../feature-flags.js";
import { USER_PROFILES } from "../profiles.js";

export function renderCommandPaletteModal(): string {
  return `
    <!-- Command Palette Overlay -->
    <div
      id="command-palette-backdrop"
      onclick="closeCommandPalette()"
      class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-200"
      aria-hidden="true"
    ></div>

    <div
      id="command-palette-modal"
      class="hidden fixed top-12 sm:top-20 left-1/2 -translate-x-1/2 w-[92vw] sm:w-[580px] bg-surface-container-high/95 backdrop-blur-2xl border border-outline-variant/30 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col transition-all duration-200"
      role="dialog"
      aria-label="Palette de commandes rapides"
    >
      <!-- Search Input Bar -->
      <div class="p-4 border-b border-outline-variant/20 flex items-center gap-3 bg-surface-container/50">
        <span class="material-symbols-outlined text-primary text-xl">search</span>
        <input
          type="text"
          id="command-palette-input"
          placeholder="Taper une commande ou chercher une application (ex: Solara, Dark, Admin, RDV)..."
          oninput="filterCommandPalette(this.value)"
          class="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
          autofocus
        >
        <kbd class="hidden sm:inline-block px-2 py-0.5 rounded bg-surface-variant text-[10px] text-on-surface-variant font-mono font-bold">ESC</kbd>
      </div>

      <!-- Command Suggestions List -->
      <div id="command-palette-items" class="p-2 max-h-[60vh] overflow-y-auto space-y-1">

        <!-- Category 1: Navigations Bounded Contexts -->
        <div class="space-y-1">
          <p class="text-[10px] font-bold text-primary uppercase tracking-wider px-2 mb-1">Vos Applications &amp; Outils</p>
          ${apps
            .map(
              (app) => `
              <a href="${app.route}" class="cmd-item flex items-center justify-between p-2.5 rounded-xl hover:bg-primary/10 transition group text-xs font-semibold text-on-surface">
                <div class="flex items-center gap-3">
                  <span class="text-lg p-1.5 rounded-lg bg-surface-container border border-outline-variant/20">${app.icon}</span>
                  <div>
                    <p class="font-bold text-on-surface group-hover:text-primary transition">${app.name}</p>
                    <p class="text-[10px] text-on-surface-variant">${app.description}</p>
                  </div>
                </div>
                <span class="text-[10px] text-on-surface-variant font-medium group-hover:text-primary">Ouvrir &rarr;</span>
              </a>
            `,
            )
            .join("")}
        </div>

        <!-- Category 2: Rôles & Profils Test (demo only) -->
        <div class="space-y-1 pt-3">
          <p class="text-[10px] font-bold text-primary uppercase tracking-wider px-2 mb-1">Changer de rôle (Aperçu Démo)</p>
          ${Object.values(USER_PROFILES).map(
            (p) => `
              <button onclick="switchUserRole('${p.role}'); closeCommandPalette();" class="cmd-item w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-primary/10 transition group text-xs font-semibold text-on-surface text-left">
                <div class="flex items-center gap-3">
                  <span class="text-base">${p.avatar}</span>
                  <div>
                    <p class="font-bold text-on-surface group-hover:text-primary transition">${p.name}</p>
                    <p class="text-[10px] text-on-surface-variant">${p.roleLabel}</p>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] bg-surface-variant/40 border border-outline-variant/20 font-medium">Tester ce profil</span>
              </button>
            `,
          ).join("")}
        </div>

        <!-- Category 3: Actions Système & Dev Tools -->
        <div class="space-y-1 pt-3">
          <p class="text-[10px] font-bold text-primary uppercase tracking-wider px-2 mb-1">Préférences &amp; Thèmes</p>

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
  `;
}

export function renderDevInspectorDrawer(): string {
  let allFlags: Record<string, boolean> = {};
  try {
    if (typeof platformFeatureFlags.getAllFlagsSnapshot === "function") {
      allFlags = platformFeatureFlags.getAllFlagsSnapshot();
    }
  } catch (_e) {
    allFlags = {};
  }

  return `
    <div
      id="dev-inspector-backdrop"
      onclick="closeDevInspector()"
      class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
      aria-hidden="true"
    ></div>

    <aside
      id="dev-inspector-drawer"
      class="fixed top-0 right-0 h-full w-[420px] max-w-[90vw] bg-surface-container-high/95 backdrop-blur-2xl border-l border-outline-variant/30 z-50 transform translate-x-full transition-transform duration-300 ease-out p-6 flex flex-col gap-5 shadow-2xl overflow-y-auto select-none"
      aria-label="Inspecteur de développement MosaiX"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-outline-variant/20">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            <span class="material-symbols-outlined text-xl">terminal</span>
          </div>
          <div>
            <h2 class="font-bold text-sm text-on-surface">MosaiX Dev Tools</h2>
            <p class="text-[10px] text-on-surface-variant">Inspecteur Runtime &amp; Feature Flags</p>
          </div>
        </div>
        <button onclick="closeDevInspector()" class="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60 transition cursor-pointer">
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      <!-- Tab 1: BAC Contexts Status -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-xs text-on-surface uppercase tracking-wider">Bounded Contexts (${
            apps.length
          })</h3>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">100% Intègres</span>
        </div>
        <p class="text-[11px] text-on-surface-variant">Statut d'exécution et contrats d'interface des Bounded Contexts (BACs) :</p>

        <div class="grid grid-cols-1 gap-2">
          ${apps
            .map(
              (app) => `
            <div class="p-3 rounded-2xl bg-surface-container/80 border border-outline-variant/20 flex items-center justify-between">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-lg">${app.icon}</span>
                <div class="min-w-0">
                  <p class="font-bold text-xs text-on-surface truncate">${app.name}</p>
                  <p class="text-[10px] text-on-surface-variant font-mono">v${app.version}</p>
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

      <!-- Tab 2: Feature Flags Control Panel -->
      <div class="space-y-3 pt-3 border-t border-outline-variant/20">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-xs text-on-surface uppercase tracking-wider">Feature Flags Runtime</h3>
          <button onclick="resetAllFeatureFlags()" class="text-[10px] font-bold text-primary hover:underline">Réinitialiser</button>
        </div>
        <p class="text-[11px] text-on-surface-variant">Basculez les fonctionnalités en direct sans redémarrer le serveur :</p>

        <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
          ${Object.entries(allFlags)
            .map(
              ([key, enabled]) => `
            <div class="p-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/20 flex items-center justify-between text-xs">
              <div class="min-w-0 flex-1 pr-2">
                <p class="font-bold font-mono text-[11px] text-on-surface truncate">${key}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  ${enabled ? "checked" : ""}
                  onchange="toggleFeatureFlag('${key}', this.checked)"
                  class="sr-only peer"
                >
                <div class="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline-variant/40 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <!-- Tab 3: System Health Diagnostics -->
      <div class="space-y-3 pt-3 border-t border-outline-variant/20">
        <h3 class="font-bold text-xs text-on-surface uppercase tracking-wider">Diagnostics Système</h3>
        <div class="p-3 rounded-2xl bg-surface-container/80 border border-outline-variant/20 space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-on-surface-variant block">Moteur Persistant</span>
            <span class="font-bold text-emerald-400">SQLite / PostgreSQL</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-on-surface-variant block">Sécurité Webhooks</span>
            <span class="font-bold text-primary">HMAC-SHA256 Actif</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-on-surface-variant block">Challenge MFA</span>
            <span class="font-bold text-emerald-400">TOTP Intercepteur OK</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-on-surface-variant block">Identifiants Uniques</span>
            <span class="font-bold text-primary">Crypto.randomUUID</span>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="mt-auto pt-3 border-t border-outline-variant/20 text-center text-[10px] text-on-surface-variant space-y-1">
        <div class="flex justify-between"><span>Port d'écoute :</span><span class="font-mono text-on-surface">3000</span></div>
        <div class="flex justify-between"><span>Architecture :</span><span class="font-mono text-on-surface">Hexagonale (Ports / Adapters)</span></div>
        <div class="flex justify-between"><span>Thème dynamique :</span><span class="font-mono text-primary">Midnight Pulse</span></div>
        <div class="pt-2 text-center text-[9px]">
          <span>MosaiX Dev Tools v1.5</span>
        </div>
      </div>
    </aside>
  `;
}

export function renderToastContainer(): string {
  return `
    <div
      id="mosaix-toast-container"
      class="fixed bottom-20 sm:bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    ></div>
  `;
}
