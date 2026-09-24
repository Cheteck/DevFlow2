/**
 * @apps/imperia/frontend/components — Shared Admin Styling & Helpers
 */

import type { AdminPageContribution } from "@mosaix/contracts";
import { shellRegistry } from "@mosaix/core";

export const ImperiaStyles = `
  .imperia-container { 
    max-width: 1200px; 
    margin: 0 auto; 
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; 
  }
  .admin-tab-btn.active {
    background-color: rgba(160, 120, 255, 0.15);
    border-color: rgba(160, 120, 255, 0.4);
    color: #dae2fd;
  }
`;

export function getAdminBadgeStyle(variant?: string): string {
  switch (variant) {
    case "primary": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "success": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "warning": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "danger": return "bg-red-500/20 text-red-300 border-red-500/30";
    case "purple": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    default: return "bg-surface-variant/40 text-on-surface-variant border-outline-variant/20";
  }
}

export function renderBacAdminSafely(page: AdminPageContribution): string {
  try {
    if (typeof page.render === "function") {
      return page.render({ activeTab: page.id });
    }
    return `
      <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/20 text-center space-y-2">
        <span class="material-symbols-outlined text-3xl text-on-surface-variant">dashboard_customize</span>
        <h4 class="text-xs font-bold text-on-surface">Console d'administration en attente de vue</h4>
        <p class="text-[11px] text-on-surface-variant">Le BAC <span class="font-mono text-primary font-bold">${page.bacId}</span> est enregistré avec la route <span class="font-mono">${page.route}</span>.</p>
      </div>
    `;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Imperia] Erreur lors du rendu de la console ${page.id}:`, err);
    return `
      <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3">
        <span class="material-symbols-outlined text-lg">error</span>
        <div>
          <strong class="font-bold">Erreur de rendu du module (${page.id})</strong>
          <p class="text-[11px] text-red-300/80 mt-0.5">${message || "Exception non gérée"}</p>
        </div>
      </div>
    `;
  }
}

export function getAggregatedAdminPages() {
  try {
    return shellRegistry.getAllAdminPages().map((page) => ({
      ...page,
      entrypoint: page.id,
    }));
  } catch (e) {
    console.error("[Imperia] Failed to aggregate admin pages from BACs:", e);
    return [];
  }
}

export function updateDefaultBac(): void {
  const select = document.getElementById("default-bac-select") as HTMLSelectElement;
  if (select && select.value) {
    shellRegistry.setDefaultBacId(select.value);
  }
}
