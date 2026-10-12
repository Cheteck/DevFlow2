/**
 * @apps/subscription — Autonomous BAC View & Descriptor
 * Self-contained SSR presentation layer for MosaiX Subscription & Billing Engine.
 */

import type { BacDescriptor, BacExecutionContext, BacRenderResult } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";

export function createSubscriptionDescriptor(): BacDescriptor {
  const PLANS = [
    { id: "plan-starter", name: "Starter", price: "0.00 € / mois", features: ["1 Espace de Travail", "Support Communautaire"] },
    { id: "plan-pro", name: "Pro", price: "29.00 € / mois", features: ["Espaces Illimités", "Support Prioritaire", "Sceau Certifié"] },
    { id: "plan-enterprise", name: "Enterprise", price: "Sur mesure", features: ["Multi-Wilaya", "SLA Garanti", "Règles Rego Custom"] }
  ];

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
      const selectedPlan = context.request.query.plan || null;
      const notificationHtml = selectedPlan ? `
        <div class="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center justify-between animate-fade-in">
          <span>✨ Votre demande de souscription au forfait <strong>${escapeHtml(selectedPlan)}</strong> a été enregistrée avec succès.</span>
          <a href="/subscription" class="text-[10px] underline font-bold">Fermer</a>
        </div>
      ` : '';

      const cardsHtml = PLANS.map(p => `
        <div class="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between space-y-4">
          <div class="space-y-2">
            <h3 class="text-sm font-bold text-on-surface">${escapeHtml(p.name)}</h3>
            <span class="text-xs font-bold text-primary block">${escapeHtml(p.price)}</span>
            <ul class="space-y-1 text-[11px] text-on-surface-variant pt-2">
              ${p.features.map(f => `<li>• ${escapeHtml(f)}</li>`).join("")}
            </ul>
          </div>
          <a href="/subscription?plan=${encodeURIComponent(p.name)}" class="w-full text-center block py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/25 text-xs font-bold text-on-surface transition cursor-pointer">
            Choisir ce forfait
          </a>
        </div>
      `).join("");

      const contentHtml = `
        <div class="space-y-6">
          <div class="flex items-center gap-3 border-b border-outline-variant/15 pb-4">
            <div class="w-10 h-10 rounded-xl bg-primary/25 text-primary flex items-center justify-center text-2xl">💳</div>
            <div>
              <h1 class="text-sm font-bold text-on-surface">Moteur d'Abonnements (Billing Engine)</h1>
              <p class="text-[11px] text-on-surface-variant">Plans, forfaits et factures consolidées pour l'organisation</p>
            </div>
          </div>

          ${notificationHtml}

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
