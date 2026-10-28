/**
 * @apps/subscription — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Subscription & Billing Engine.
 * Note: Subscription plans are currently seeded in-memory via SubscriptionService pending DB port migration.
 */
/* AUDIT-RESET a055b8e (2026-10-13) — AUCUNE PERTE DÉTECTÉE.
 * Le diff de a055b8e (notification conditionnée à subscriptionSuccess + ConsoleLogger) correspond à l'étape
 * "UI honnêtes" : le parent affichait un succès dès ?plan= présent, même en cas d'échec de subscribe().
 * Vérification restante : couvrir les chemins échec/guest avant toute restauration. */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { ConsoleLogger } from "@mosaix/core";
import { SubscriptionService } from "../domain/subscription.service.js";

const logger = new ConsoleLogger("info", { component: "SubscriptionView" });

export function createSubscriptionDescriptor(service?: SubscriptionService): BacDescriptor {
  const subscriptionService = service || new SubscriptionService();

  return {
    id: "@apps/subscription",
    name: "Subscription Engine",
    version: "1.0.0",
    routePrefix: "/subscription",
    icon: "💳",
    isEnabled: true,
    requiredPermissions: ["subscription:billing:read"],

    async isAvailable(): Promise<boolean> {
      return true;
    },

    async render(context: BacExecutionContext): Promise<BacRenderResult> {
      const user = context.user;
      const userId = user.id || "guest";
      const selectedPlanId = context.request.query.plan || null;
      let subscriptionSuccess = false;

      // Handle subscription request if query contains plan and valid user
      if (selectedPlanId && userId !== "guest") {
        try {
          await subscriptionService.subscribe(userId, selectedPlanId);
          subscriptionSuccess = true;
        } catch (err) {
          logger.error(`Subscription error for user ${userId}:`, { err: String(err) });
          subscriptionSuccess = false;
        }
      }

      // Retrieve current user active subscription and list all available plans from Domain Service
      const activeSubscription = userId !== "guest" ? await subscriptionService.getUserSubscriptionAsync(userId) : undefined;
      const plans = subscriptionService.listPlans();

      const notificationHtml = subscriptionSuccess && selectedPlanId ? `
        <div class="p-3 rounded-xl bg-info-container border border-info/20 text-xs text-on-info font-medium flex items-center justify-between animate-fade-in">
          <span>✨ Votre souscription au forfait <strong>${escapeHtml(selectedPlanId)}</strong> a été activée avec succès !</span>
          <a href="/subscription" class="text-[10px] underline font-bold">Masquer</a>
        </div>
      ` : '';

      const activeStatusBannerHtml = activeSubscription ? `
        <div class="p-4 rounded-xl bg-success-container border border-success/20 text-xs text-on-success flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">verified</span>
            <span>Abonnement Actif : <strong class="uppercase font-bold">${escapeHtml(activeSubscription.planId)}</strong></span>
          </div>
          <span class="text-[10px] text-on-success font-mono">Status: ${escapeHtml(activeSubscription.status)}</span>
        </div>
      ` : '';

      const cardsHtml = plans.map(p => {
        const isCurrentPlan = activeSubscription?.planId === p.id;
        const priceLabel = p.priceInCents === 0 ? "Gratuit" : `${(p.priceInCents / 100).toFixed(2)} € / mois`;

        return `
          <div class="glass-card p-5 rounded-2xl border ${isCurrentPlan ? 'border-primary shadow-lg shadow-primary/10' : 'border-outline-variant/20'} flex flex-col justify-between space-y-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-on-surface">${escapeHtml(p.name)}</h3>
                ${isCurrentPlan ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary text-on-primary">Actif</span>' : ''}
              </div>
              <span class="text-xs font-bold text-primary block">${escapeHtml(priceLabel)}</span>
              <p class="text-[11px] text-on-surface-variant/80">${escapeHtml(p.description)}</p>
              <ul class="space-y-1 text-[11px] text-on-surface-variant pt-2">
                ${p.features.map(f => `<li>• ${escapeHtml(f)}</li>`).join("")}
              </ul>
            </div>

            ${isCurrentPlan ? `
              <button disabled class="w-full text-center block py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 text-xs font-bold opacity-80 cursor-default">
                Forfait Actuel
              </button>
            ` : `
              <a href="/subscription?plan=${encodeURIComponent(p.id)}" class="w-full text-center block py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-xs font-bold text-on-surface transition cursor-pointer">
                Activer ce forfait
              </a>
            `}
          </div>
        `;
      }).join("");

      const contentHtml = `
        <div class="space-y-6">
          <div class="flex items-center gap-3 border-b border-outline-variant/15 pb-4">
            <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-2xl">credit_card</span>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-on-surface tracking-tight">Moteur d'Abonnements (Billing Engine)</h1>
              <p class="text-xs text-on-surface-variant">Plans, forfaits et factures consolidées pour l'organisation</p>
            </div>
          </div>

          ${notificationHtml}
          ${activeStatusBannerHtml}

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${cardsHtml}
          </div>
        </div>
      `;

      return {
        contentHtml,
        pageTitle: "Subscriptions — Moteur de Facturation",
      };
    },
  };
}
