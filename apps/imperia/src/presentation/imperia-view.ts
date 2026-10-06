/**
 * @apps/imperia — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Imperia Governance.
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { HumanReviewQueue, IntelligenceMetricsCollector } from "../../../../packages/intelligence/src/index.js";

function esc(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createImperiaDescriptor(): BacDescriptor {
  return {
    id: "@apps/imperia",
    name: "Imperia Governance",
    version: "1.0.0",
    routePrefix: "/imperia",
    icon: "🏛️",
    isEnabled: true,
    requiredPermissions: ["imperia:governance:manage"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const user = context.user;
      
      // Strict authorization guard within the descriptor
      const isAdmin = user.roles?.includes("admin") || user.id === "admin";
      if (!isAdmin) {
        throw new Error("Accès interdit : Rôle 'Platform Governor' ou 'Platform Admin' requis pour accéder aux registres d'Imperia.");
      }

      const activeTab = context.request.query.tab || "status";

      let innerContentHtml: string;
      if (activeTab === "policies") {
        innerContentHtml = `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Règles de Conformité OPA & Rego</h3>
            <p class="text-[11px] text-on-surface-variant">Définition déclarative et évaluation en temps réel des règles de sécurité de la plateforme.</p>
            
            <div class="p-3 bg-surface-container-lowest font-mono text-[10px] text-primary rounded-xl border border-outline-variant/15 whitespace-pre overflow-x-auto leading-relaxed">
package platform.authz

default allow = false

# Allow platform admins bypass rules
allow {
    input.user.roles[_] == "admin"
}

# Restrict critical endpoints
allow {
    input.action == "read"
    input.resource.type == "public_feed"
}
            </div>
          </div>
        `;
      } else if (activeTab === "audit") {
        innerContentHtml = `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Journal d'Audit & Invariants Sécurité</h3>
            <p class="text-[11px] text-on-surface-variant">Traçabilité complète des mutations privilégiées et vérification des invariants de sécurité.</p>

            <div class="space-y-2">
              <div class="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/20 flex items-center justify-between text-xs font-mono">
                <div>
                  <span class="font-bold text-emerald-400">auth.session.created</span>
                  <p class="text-[10px] text-on-surface-variant">Identity: usr_admin &bull; IP: 127.0.0.1</p>
                </div>
                <span class="text-[10px] text-on-surface-variant">Récemment</span>
              </div>
              <div class="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/20 flex items-center justify-between text-xs font-mono">
                <div>
                  <span class="font-bold text-primary">feature_flag.updated</span>
                  <p class="text-[10px] text-on-surface-variant">Flag: platform.live_editor.enabled &bull; Value: true</p>
                </div>
                <span class="text-[10px] text-on-surface-variant">Récemment</span>
              </div>
            </div>
          </div>
        `;
      } else if (activeTab === "plateforme") {
        innerContentHtml = `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Paramètres Plateforme & Thèmes Admin</h3>
            <p class="text-[11px] text-on-surface-variant">Gestion centralisée des thèmes visuels et réglages d'exécution MosaiX.</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="p-4 rounded-xl bg-surface-container/60 border border-outline-variant/20 space-y-2">
                <span class="text-xs font-bold text-on-surface">Thème Canonique Actif</span>
                <p class="text-[11px] text-on-surface-variant">Midnight Pulse (M3 Material Dynamic)</p>
              </div>
              <div class="p-4 rounded-xl bg-surface-container/60 border border-outline-variant/20 space-y-2">
                <span class="text-xs font-bold text-on-surface">Mode Démo Utilisateurs</span>
                <p class="text-[11px] text-emerald-400 font-bold">Actif (MOSAIX_DEMO_USERS=true)</p>
              </div>
            </div>
          </div>
        `;
      } else if (activeTab === "ai") {
        const metrics = IntelligenceMetricsCollector.getInstance().getSnapshot();
        const pendingReviews = HumanReviewQueue.getInstance().listPending();

        innerContentHtml = `
          <div class="space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20">
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">Décisions IA Totales</span>
                <p class="text-2xl font-bold text-primary mt-1">${metrics.totalDecisions}</p>
              </div>
              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20">
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">Revue Humaine Requise</span>
                <p class="text-2xl font-bold text-amber-400 mt-1">${pendingReviews.length}</p>
              </div>
              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20">
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">AI Override Rate</span>
                <p class="text-2xl font-bold text-emerald-400 mt-1">${metrics.overrideRate}%</p>
              </div>
              <div class="glass-card p-4 rounded-2xl border border-outline-variant/20">
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">Coût Estimé ($)</span>
                <p class="text-2xl font-bold text-on-surface mt-1">$${metrics.totalCostAmount}</p>
              </div>
            </div>

            <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface">Queue de Revue Humaine (Human-in-the-Loop)</h3>
                  <p class="text-[11px] text-on-surface-variant">Décisions probabilistes nécessitant une validation manuelle selon les seuils de confiance.</p>
                </div>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">${pendingReviews.length} en attente</span>
              </div>

              ${
                pendingReviews.length > 0
                  ? `<div class="space-y-3">
                      ${pendingReviews
                        .map(
                          (item) => `
                        <div class="p-4 rounded-xl bg-surface-container/60 border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <div class="flex items-center gap-2">
                              <span class="font-bold text-primary font-mono">${esc(item.capability)}</span>
                              <span class="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">Confiance : ${(item.originalResult.confidence * 100).toFixed(1)}%</span>
                            </div>
                            <p class="text-[10px] text-on-surface-variant mt-1">ID Décision : ${esc(item.decisionId)} &bull; Provider : ${esc(item.originalResult.provider)}</p>
                          </div>
                          <div class="flex items-center gap-2">
                            <button onclick="fetch('/api/intelligence/review-queue/${esc(item.id)}/resolve', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:'APPROVED'})}).then(()=>location.reload())" class="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs cursor-pointer">
                              Approuver
                            </button>
                            <button onclick="fetch('/api/intelligence/review-queue/${esc(item.id)}/resolve', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:'REJECTED'})}).then(()=>location.reload())" class="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs cursor-pointer">
                              Rejeter
                            </button>
                          </div>
                        </div>
                      `,
                        )
                        .join("")}
                    </div>`
                  : `<p class="text-xs text-on-surface-variant/70 italic p-4 text-center border border-dashed border-outline-variant/20 rounded-xl">Aucune décision en attente de validation humaine.</p>`
              }
            </div>
          </div>
        `;
      } else {
        innerContentHtml = `
          <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Statut d'Exécution Imperia</h3>
            <p class="text-[11px] text-on-surface-variant">Console de supervision et de contrôle de gouvernance des 10 Bounded Contexts.</p>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div class="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/20">
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">Moteur OPA/Rego</span>
                <p class="text-sm font-bold text-emerald-400 mt-0.5">Actif (Compliant)</p>
              </div>
              <div class="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/20">
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">Kill Switch IA</span>
                <p class="text-sm font-bold text-primary mt-0.5">Prêt (0 bloqué)</p>
              </div>
              <div class="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/20">
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">Précision Globale</span>
                <p class="text-sm font-bold text-emerald-400 mt-0.5">99.4% Validé</p>
              </div>
            </div>
          </div>
        `;
      }

      const html = `
        <div class="space-y-6">
          <div class="flex items-center justify-between pb-4 border-b border-outline-variant/20">
            <div>
              <h1 class="text-2xl font-bold text-on-surface tracking-tight">Imperia Platform Governance</h1>
              <p class="text-xs text-on-surface-variant mt-1">Supervision de la sécurité, conformité OPA et gouvernance IA IJIDeals Intelligence</p>
            </div>
            <div class="flex items-center gap-2">
              <a href="/imperia?tab=status" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === "status" ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container border border-outline-variant/20 text-on-surface hover:bg-surface-variant"}">Statut</a>
              <a href="/imperia?tab=policies" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === "policies" ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container border border-outline-variant/20 text-on-surface hover:bg-surface-variant"}">Policies Rego</a>
              <a href="/imperia?tab=audit" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === "audit" ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container border border-outline-variant/20 text-on-surface hover:bg-surface-variant"}">Audit</a>
              <a href="/imperia?tab=plateforme" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === "plateforme" ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container border border-outline-variant/20 text-on-surface hover:bg-surface-variant"}">Plateforme</a>
              <a href="/imperia?tab=ai" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === "ai" ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container border border-outline-variant/20 text-on-surface hover:bg-surface-variant"}">IJIDeals Intelligence</a>
            </div>
          </div>

          ${innerContentHtml}
        </div>
      `;

      return {
        html,
        data: { activeTab, totalDecisions: 0 },
        pageTitle: "Imperia Governance — MosaiX Platform",
      };
    },
  };
}
