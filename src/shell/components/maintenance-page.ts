/**
 * @shell/components — Maintenance Mode Page Component
 */

import { escapeHtml } from "@mosaix/support";

export function renderMaintenancePage(reason?: string, estimatedDurationMinutes?: number): string {
  const displayReason = reason || "Nous effectuons des opérations de maintenance programmée pour améliorer votre expérience.";
  const displayDuration = estimatedDurationMinutes
    ? `<div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
        <span class="material-symbols-outlined text-sm">schedule</span>
        <span>Durée estimée : ~${estimatedDurationMinutes} minutes</span>
       </div>`
    : "";

  return `
    <main class="min-h-screen flex items-center justify-center p-6 bg-surface-container-lowest text-on-surface">
      <div class="max-w-md w-full bg-surface-container-low border border-outline-variant/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <span class="material-symbols-outlined text-3xl">build_circle</span>
        </div>

        <div class="space-y-2">
          <h1 class="text-2xl font-black tracking-tight text-on-surface">Maintenance en cours</h1>
          <p class="text-xs text-on-surface-variant leading-relaxed">
            ${escapeHtml(displayReason)}
          </p>
        </div>

        ${displayDuration}

        <div class="pt-4 border-t border-outline-variant/20 flex flex-col items-center gap-3">
          <p class="text-[11px] text-on-surface-variant/80">
            Les services reprendront automatiquement dès la fin des opérations.
          </p>
          <a href="/identity" class="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm">admin_panel_settings</span>
            Accès Administration Plateforme
          </a>
        </div>
      </div>
    </main>
  `;
}
