/**
 * @apps/solidarity — Presentation View & Descriptor
 * Self-contained SSR view for Solidarity Hub (needs, ops, volunteers, OCHA reports).
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";

export interface OpsNeed {
  id: string;
  title: string;
  zone: string;
  requested: number;
  distributed: number;
  unit: string;
  status: "OPEN" | "CLOSED";
}

export interface SolidarityOpsSource {
  listNeeds?(): OpsNeed[];
  getNeeds?(): unknown[];
}

export type SolidaritySubViewRenderer = (
  context: BacExecutionContext,
  deps: { solidarityService?: SolidarityOpsSource; needs: OpsNeed[]; isAdmin: boolean },
) => Promise<string | BacRenderResult> | string | BacRenderResult;

const solidaritySubViewRegistry = new Map<string, SolidaritySubViewRenderer>();

export function registerSolidaritySubView(viewKey: string, renderer: SolidaritySubViewRenderer): void {
  solidaritySubViewRegistry.set(viewKey, renderer);
}

function calculateCoveragePercent(requested: number, distributed: number): number {
  if (requested <= 0) return 0;
  return Math.min(100, Math.round((distributed / requested) * 100));
}

export function toOpsNeeds(service?: SolidarityOpsSource): OpsNeed[] {
  if (service) {
    if (typeof service.listNeeds === "function") {
      return service.listNeeds();
    }
    if (typeof service.getNeeds === "function") {
      const raw = service.getNeeds() || [];
      return raw.map((item) => {
        const n = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          id: String(n.id ?? ""),
          title: String(n.type ?? n.title ?? "Besoin"),
          zone: String(n.geoZone ?? n.zone ?? "Non spécifiée"),
          requested: Number(n.quantityRequired ?? n.requested ?? 0),
          distributed: Number(n.quantitySatisfied ?? n.distributed ?? 0),
          unit: String(n.unit ?? "unité"),
          status: n.status === "CLOSED" ? "CLOSED" : "OPEN",
        };
      });
    }
  }
  return [];
}

function needCard(n: OpsNeed): string {
  const pct = calculateCoveragePercent(n.requested, n.distributed);
  const remaining = Math.max(0, n.requested - n.distributed);
  return `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-primary/40 transition duration-200">
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${n.status === "OPEN" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-surface-container text-on-surface-variant"} font-mono">
                  ${n.status}
                </span>
                <span class="text-[10px] font-mono text-on-surface-variant">#${escapeHtml(n.id)}</span>
              </div>
              <div>
                <h3 class="text-xs font-bold text-on-surface mt-1">${escapeHtml(n.title)}</h3>
                <p class="text-[10px] text-on-surface-variant mt-0.5">${escapeHtml(n.zone)}</p>
                <div class="mt-4 space-y-1.5">
                  <div class="flex justify-between text-[9px] text-on-surface-variant font-mono tabular-nums">
                    <span>Distribue :</span>
                    <span class="font-bold text-on-surface">${pct}% (${n.distributed} / ${n.requested} ${escapeHtml(n.unit)}, reste ${remaining})</span>
                  </div>
                  <div class="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden border border-outline-variant/10">
                    <div class="bg-primary h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                  </div>
                  <p class="text-[9px] text-on-surface-variant">Couverture = distribue / demande. Promesses et transit sans effet.</p>
                </div>
              </div>
            </div>
          </div>`;
}

function emptyState(title: string, message: string): string {
  return `
          <div class="glass-card rounded-2xl p-8 text-center space-y-4">
            <h3 class="text-sm font-bold text-on-surface">${escapeHtml(title)}</h3>
            <p class="text-xs text-on-surface-variant">${escapeHtml(message)}</p>
          </div>`;
}

export function createSolidarityDescriptor(deps: { solidarityService?: SolidarityOpsSource } = {}): BacDescriptor {
  return {
    id: "@apps/solidarity",
    name: "Solidarity",
    version: "1.0.0",
    routePrefix: "/solidarity",
    icon: "🤝",
    isEnabled: true,
    requiredPermissions: ["solidarity:campaign:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const view = context.request.query.view || "list";
      const user = context.user;
      const isAdmin = user.roles?.includes("admin") || user.id === "admin";
      const needs = toOpsNeeds(deps.solidarityService);

      // Check registered custom subview handlers (OCP extension)
      const customRenderer = solidaritySubViewRegistry.get(view);
      if (customRenderer) {
        const customRes = await customRenderer(context, { solidarityService: deps.solidarityService, needs, isAdmin });
        if (typeof customRes === "object" && customRes !== null && "contentHtml" in customRes) {
          return customRes;
        }
        return {
          contentHtml: String(customRes),
          pageTitle: `Solidarity — ${view}`,
        };
      }

      let innerViewHtml: string;
      if (view === "needs") {
        innerViewHtml = `
          <div class="space-y-6">
            <div class="flex justify-between items-center flex-wrap gap-2">
              <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Registre des besoins — compteurs stricts</h2>
              ${isAdmin ? `
                <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Signalement enregistre pour qualification'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1 cursor-pointer">
                  <span class="material-symbols-outlined text-sm">add_circle</span>
                  <span>Signaler un besoin</span>
                </button>
              ` : ""}
            </div>
            ${
              needs.length === 0
                ? emptyState(
                    "Aucun besoin pour le moment",
                    "Les besoins declares et qualifies apparaitront ici avec leurs compteurs stricts.",
                  )
                : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${needs.map(needCard).join("")}</div>`
            }
          </div>
        `;
      } else if (view === "volunteers") {
        innerViewHtml = `
          <div class="space-y-6">
            <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Benevoles — capacite operationnelle (references opaques)</h2>
            ${emptyState(
              "Referencement via Citadelle",
              "Les benevoles sont referencia par identifiants opaques. Affectation uniquement sur proposition acceptee, avec briefing et prerequis valides.",
            )}
          </div>
        `;
      } else if (view === "reports") {
        innerViewHtml = `
          <div class="glass-card p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Rapports d'impact humanitaire (Norme OCHA / HXL)</h3>
            <p class="text-[11px] text-on-surface-variant">Agregats exportables au format HXL, sans beneficiaires ni localisations sensibles. Couverture = distribue / demande.</p>
            <div class="space-y-3">
              <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/10 flex items-center justify-between text-xs">
                <div>
                  <h4 class="font-bold">Rapport OCHA — export HXL v1</h4>
                  <p class="text-[10px] text-on-surface-variant">#crisis+name, #adm1+code, #indicator+num+needed, #indicator+num+distributed, #indicator+pct+coverage</p>
                </div>
                <button onclick="const t = document.createElement('div'); t.className='fixed bottom-6 right-6 p-4 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all duration-300 z-50'; t.textContent='Export du rapport HXL lance !'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);" class="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-[10px] cursor-pointer">Exporter HXL</button>
              </div>
            </div>
          </div>
        `;
      } else {
        const totalRequested = needs.reduce((s, n) => s + n.requested, 0);
        const totalDistributed = needs.reduce((s, n) => s + n.distributed, 0);
        const pct = calculateCoveragePercent(totalRequested, totalDistributed);
        const openCount = needs.filter((n) => n.status === "OPEN").length;

        innerViewHtml = `
          <div class="space-y-6">
            ${
              needs.length === 0
                ? emptyState(
                    "Aucune operation pour le moment",
                    "Les incidents, besoins et distributions suivis apparaitront ici des leur qualification.",
                  )
                : `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/15 flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Besoins ouverts</span>
                <span class="text-xl font-bold text-primary font-mono tabular-nums">${openCount}</span>
              </div>
              <div class="p-5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/15 flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Couverture confirmee</span>
                <span class="text-xl font-bold text-primary font-mono tabular-nums">${pct}%</span>
              </div>
              <div class="p-5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/15 flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Distribue / demande</span>
                <span class="text-xl font-bold text-primary font-mono tabular-nums">${totalDistributed}/${totalRequested}</span>
              </div>
            </div>`
            }
            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-2">
              <h3 class="text-xs font-bold text-on-surface">Vue operationnelle</h3>
              <p class="text-[11px] text-on-surface-variant">Un besoin n'est couvert que par distribution confirmee. Les affectations de benevoles exigent acceptation explicite et briefing.</p>
            </div>
          </div>
        `;
      }

      const contentHtml = `
        <div class="space-y-6">
          <div class="flex justify-between items-center border-b border-outline-variant/15 pb-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">🤝</div>
              <div>
                <h1 class="text-sm font-bold text-on-surface">Solidarity Hub</h1>
                <p class="text-[11px] text-on-surface-variant">Besoins, benevoles, missions et conformite OCHA</p>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/solidarity?view=list" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === "list" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15"}">
                Operations
              </a>
              <a href="/solidarity?view=needs" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === "needs" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15"}">
                Besoins
              </a>
              <a href="/solidarity?view=volunteers" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === "volunteers" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15"}">
                Benevoles
              </a>
              <a href="/solidarity?view=reports" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${view === "reports" ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/15"}">
                Rapports OCHA / HXL
              </a>
            </div>
          </div>
          ${innerViewHtml}
        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Solidarity — Aide Humanitaire & Crises",
      };
    },
  };
}
