/**
 * @shell/renderer — Central HTML rendering engine for MosaiX Platform.
 * Decomposed into modular render subcomponents under src/shell/render/
 */

import { type BacDescriptor } from "@mosaix/core";

// Re-export modular render subcomponents
export {
  renderPrimarySidebar,
  renderSecondarySidebar,
} from "./render/sidebar.js";

export {
  renderUserSwitcherWidget,
} from "./render/user-menu.js";

export {
  renderMobileDrawer,
  renderMobileCreateSheet,
  renderMobileNotificationsSheet,
  renderMobileBottomNav,
} from "./render/mobile.js";

export {
  renderCommandPaletteModal,
  renderDevInspectorDrawer,
  renderToastContainer,
} from "./render/modals.js";

export function renderHeaderSearchAndDevControls(): string {
  return `
    <div class="flex items-center gap-3 w-full sm:w-auto">
      <!-- Search Trigger (Cmd+K) -->
      <button 
        onclick="toggleCommandPalette()"
        class="flex-1 sm:flex-initial flex items-center justify-between gap-4 px-3.5 py-2 rounded-2xl bg-surface-container-high/60 hover:bg-surface-variant border border-outline-variant/30 text-xs text-on-surface-variant transition-all cursor-pointer group shadow-inner"
        title="Recherche Rapide (⌘K / Ctrl+K)"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-lg text-on-surface-variant group-hover:text-primary transition-colors">search</span>
          <span class="font-medium">Rechercher une application, un document...</span>
        </div>
        <kbd class="hidden sm:inline-block px-1.5 py-0.5 rounded bg-surface-container-highest text-[10px] font-mono font-bold text-on-surface-variant group-hover:text-on-surface border border-outline-variant/30">⌘K</kbd>
      </button>

      <!-- Dev Inspector Drawer Toggle Button -->
      <button
        onclick="toggleDevInspector()"
        class="p-2 rounded-2xl bg-surface-container-high/60 hover:bg-surface-variant border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-all cursor-pointer relative group"
        title="Inspecteur Dev Tools MosaiX"
        aria-label="Inspecteur Dev Tools MosaiX"
      >
        <span class="material-symbols-outlined text-xl group-hover:rotate-45 transition-transform duration-300">bug_report</span>
        <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400"></span>
      </button>
    </div>
  `;
}

export function renderMaintenancePage(
  durationMinutes = 30,
  adminRole = "admin",
): string {
  const duration = Number.isFinite(Number(durationMinutes))
    ? durationMinutes
    : 30;

  return `
    <!DOCTYPE html>
    <html lang="fr" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MosaiX — Maintenance en cours</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
      <style>
        body {
          background-color: #0f172a;
          color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
        }
      </style>
    </head>
    <body class="h-full flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-slate-800/80 border border-slate-700/60 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
        <div class="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
          <span class="material-symbols-outlined text-4xl">engineering</span>
        </div>

        <div class="space-y-2">
          <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Maintenance Programmée (FEAT-01)
          </span>
          <h1 class="text-2xl font-bold tracking-tight text-on-surface">Plateforme Momentanément Indisponible</h1>
          <p class="text-xs text-slate-400 leading-relaxed">
            MosaiX effectue une mise à jour d'infrastructure. Nos services seront de retour sous peu.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-700/40 text-left">
          <div>
            <span class="text-on-surface-variant block text-[10px] uppercase">Durée estimée</span>
            <span class="font-bold text-amber-400 font-mono text-sm">~ ${duration} min</span>
          </div>
          <div>
            <span class="text-on-surface-variant block text-[10px] uppercase">Statut Services</span>
            <span class="font-bold text-emerald-400 font-mono text-sm">Sécurisés</span>
          </div>
        </div>

        <div class="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-700/30 text-left text-[11px] text-slate-400 leading-relaxed">
          <p>Les administrateurs peuvent se connecter avec leurs identifiants de gouvernance ou utiliser les en-têtes d'authentification privilégiés.</p>
        </div>

        <div class="pt-2 border-t border-slate-700/40 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Rôle Bypass : ${adminRole}</span>
          <span>HTTP 503 Service Unavailable</span>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function renderBacAdminSafely(
  bac: BacDescriptor,
  context: { userRole?: string; spaceId?: string },
): string {
  const isAllowed =
    context.userRole === "admin" ||
    context.userRole === "superadmin" ||
    context.userRole === "imperia";

  if (!isAllowed) {
    return `
      <div class="p-8 max-w-lg mx-auto my-12 bg-surface-container-high/95 border border-error/30 rounded-3xl shadow-2xl text-center space-y-4 backdrop-blur-xl">
        <div class="w-14 h-14 rounded-2xl bg-error/15 text-error border border-error/30 flex items-center justify-center mx-auto text-2xl font-bold">
          <span class="material-symbols-outlined text-3xl">lock</span>
        </div>
        <div>
          <h2 class="text-lg font-bold text-on-surface">Accès Administration Restreint</h2>
          <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">
            La console d'administration pour <strong>${
              bac.displayName
            }</strong> exige le privilège d'administration globale ou de gouvernance Imperia.
          </p>
        </div>
        <div class="p-3 rounded-2xl bg-surface-container/60 border border-outline-variant/20 text-[11px] text-on-surface-variant font-mono">
          Rôle détecté : <span class="text-error font-bold">${
            context.userRole || "guest"
          }</span>
        </div>
        <a href="${
          bac.route
        }" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition shadow-md shadow-primary/20">
          &larr; Retour à l'application ${bac.displayName}
        </a>
      </div>
    `;
  }

  return `
    <div class="p-6 max-w-6xl mx-auto space-y-6">
      <div class="flex items-center justify-between pb-4 border-b border-outline-variant/20">
        <div class="flex items-center gap-3">
          <span class="text-3xl">${bac.icon}</span>
          <div>
            <h1 class="text-xl font-bold text-on-surface">Administration ${
              bac.displayName
            }</h1>
            <p class="text-xs text-on-surface-variant">Console de contrôle et paramétrage du Bounded Context (${
              bac.id
            })</p>
          </div>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-mono font-bold bg-primary/20 text-primary border border-primary/30">
          Gouvernance Active
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-surface-container-high/80 border border-outline-variant/20 space-y-2">
          <div class="flex items-center gap-2 text-primary">
            <span class="material-symbols-outlined text-base">verified_user</span>
            <span class="font-bold text-xs">Accès Sécurisé</span>
          </div>
          <p class="text-xs text-on-surface-variant/90 leading-relaxed">Vos données sont protégées et isolées selon vos droits d'accès.</p>
        </div>
        <div class="p-5 rounded-2xl bg-surface-container-high/80 border border-outline-variant/20 space-y-2">
          <div class="flex items-center gap-2 text-emerald-400">
            <span class="material-symbols-outlined text-base">sync</span>
            <span class="font-bold text-xs">Synchronisation Directe</span>
          </div>
          <p class="text-xs text-on-surface-variant/90 leading-relaxed">Les modifications sont synchronisées en continu avec vos collaborateurs.</p>
        </div>
        <div class="p-5 rounded-2xl bg-surface-container-high/80 border border-outline-variant/20 space-y-2">
          <div class="flex items-center gap-2 text-amber-400">
            <span class="material-symbols-outlined text-base">build</span>
            <span class="font-bold text-xs">Outils Intégrés</span>
          </div>
          <p class="text-xs text-on-surface-variant/90 leading-relaxed">Retrouvez toutes les actions de ce module dans la barre latérale.</p>
        </div>
      </div>
    </div>
  `;
}
