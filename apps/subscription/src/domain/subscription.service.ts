import type { SubscriptionPlan, UserSubscription } from "./subscription.js";

export class SubscriptionService {
  private plans = new Map<string, SubscriptionPlan>();
  private subscriptions = new Map<string, UserSubscription>();

  constructor() {
    this.seedDefaultPlans();
  }

  private seedDefaultPlans(): void {
    const plans: SubscriptionPlan[] = [
      {
        id: "plan-community-free",
        name: "Community Starter",
        description: "Accès gratuit aux espaces publics, fil d'actualité et messagerie solidaire.",
        priceInCents: 0,
        currency: "EUR",
        interval: "month",
        features: ["1 espace communautaire", "Fil social Solara", "Messagerie Beam", "Support communautaire"],
        capabilitiesAllowed: ["social.post.create", "beam.message.send", "solidarity.need.declare"],
      },
      {
        id: "plan-pro-creator",
        name: "Pro Créateur",
        description: "Boutique en ligne, gestion de stocks, catalogue complet et billetterie avancée.",
        priceInCents: 2900,
        currency: "EUR",
        interval: "month",
        features: ["Espaces illimités", "Boutique Commerce & Portfolio", "Réservations Booking prioritaires", "Support 24/7"],
        capabilitiesAllowed: [
          "social.post.create",
          "beam.message.send",
          "commerce.order.create",
          "portfolio.vendable.create",
          "booking.slot.create",
        ],
      },
      {
        id: "plan-enterprise-imperia",
        name: "Entreprise & Fédération",
        description: "Gouvernance complète Imperia, topologie distribuée, audit log étendu et SLA garanti.",
        priceInCents: 9900,
        currency: "EUR",
        interval: "month",
        features: ["Plan de contrôle Imperia", "Circuit breakers & DLQ replay", "Multi-tenancy illimité", "Audit log 365 jours"],
        capabilitiesAllowed: [
          "imperia.governance.inspect",
          "imperia.governance.audit",
          "imperia.topology.query",
          "spaces.space.manage",
        ],
      },
    ];

    for (const p of plans) {
      this.plans.set(p.id, p);
    }
  }

  listPlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values());
  }

  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.plans.get(planId);
  }

  getUserSubscription(userId: string): UserSubscription | undefined {
    return Array.from(this.subscriptions.values()).find(
      (s) => s.userId === userId && (s.status === "active" || s.status === "trialing")
    );
  }

  subscribe(userId: string, planId: string): UserSubscription {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan [${planId}] non trouvé.`);
    }

    const now = Date.now();
    const periodEnd = now + 1000 * 60 * 60 * 24 * 30; // 30 days
    const subId = `sub_${userId}_${Date.now()}`;

    const sub: UserSubscription = {
      id: subId,
      userId,
      planId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      meteredUsageUnits: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.set(sub.id, sub);
    return sub;
  }

  recordMeteredUsage(userId: string, units: number): UserSubscription | undefined {
    const sub = this.getUserSubscription(userId);
    if (!sub) return undefined;

    sub.meteredUsageUnits += units;
    sub.updatedAt = Date.now();
    this.subscriptions.set(sub.id, sub);
    return sub;
  }

  isCapabilityAllowed(userId: string, capabilityId: string): boolean {
    const sub = this.getUserSubscription(userId);
    // If no active paid plan, check against free plan
    const effectivePlanId = sub?.planId || "plan-community-free";
    const plan = this.plans.get(effectivePlanId);
    if (!plan) return false;

    return plan.capabilitiesAllowed.includes(capabilityId);
  }
}
