import type { DatabasePort } from "@mosaix/ports-database";
import type { SubscriptionPlan, UserSubscription } from "./subscription.js";

export class SubscriptionService {
  private plans = new Map<string, SubscriptionPlan>();
  private subscriptions = new Map<string, UserSubscription>();

  constructor(private readonly db?: DatabasePort) {
    this.seedDefaultPlans();
    if (this.db) {
      void this.initDatabaseTable();
    }
  }

  private async initDatabaseTable(): Promise<void> {
    if (!this.db) return;
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        plan_id TEXT,
        status TEXT,
        current_period_start INTEGER,
        current_period_end INTEGER,
        cancel_at_period_end INTEGER,
        metered_usage_units INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      )
    `).catch(() => null);

    // Load existing subscriptions from DB
    const rows = await this.db.query<Record<string, unknown>>(`SELECT * FROM user_subscriptions`).catch(() => []);
    for (const r of rows) {
      const sub: UserSubscription = {
        id: String(r["id"]),
        userId: String(r["user_id"] || ""),
        planId: String(r["plan_id"] || ""),
        status: String(r["status"] || "active") as any,
        currentPeriodStart: Number(r["current_period_start"] || Date.now()),
        currentPeriodEnd: Number(r["current_period_end"] || Date.now()),
        cancelAtPeriodEnd: Boolean(r["cancel_at_period_end"]),
        meteredUsageUnits: Number(r["metered_usage_units"] || 0),
        createdAt: Number(r["created_at"] || Date.now()),
        updatedAt: Number(r["updated_at"] || Date.now()),
      };
      this.subscriptions.set(sub.id, sub);
    }
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

  async getUserSubscriptionAsync(userId: string): Promise<UserSubscription | undefined> {
    if (this.db) {
      const rows = await this.db.query<Record<string, unknown>>(
        `SELECT * FROM user_subscriptions WHERE user_id = ? AND (status = 'active' OR status = 'trialing') LIMIT 1`,
        [userId]
      ).catch(() => []);
      if (rows.length > 0) {
        const r = rows[0];
        const sub: UserSubscription = {
          id: String(r["id"]),
          userId: String(r["user_id"] || ""),
          planId: String(r["plan_id"] || ""),
          status: String(r["status"] || "active") as any,
          currentPeriodStart: Number(r["current_period_start"] || Date.now()),
          currentPeriodEnd: Number(r["current_period_end"] || Date.now()),
          cancelAtPeriodEnd: Boolean(r["cancel_at_period_end"]),
          meteredUsageUnits: Number(r["metered_usage_units"] || 0),
          createdAt: Number(r["created_at"] || Date.now()),
          updatedAt: Number(r["updated_at"] || Date.now()),
        };
        this.subscriptions.set(sub.id, sub);
        return sub;
      }
    }
    return this.getUserSubscription(userId);
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

    if (this.db) {
      void this.db.query(
        `INSERT INTO user_subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, metered_usage_units, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           status = excluded.status,
           current_period_start = excluded.current_period_start,
           current_period_end = excluded.current_period_end,
           metered_usage_units = excluded.metered_usage_units,
           updated_at = excluded.updated_at`,
        [sub.id, sub.userId, sub.planId, sub.status, sub.currentPeriodStart, sub.currentPeriodEnd, sub.cancelAtPeriodEnd ? 1 : 0, sub.meteredUsageUnits, sub.createdAt, sub.updatedAt]
      ).catch((err) => {
        console.error("[Subscription] Failed to persist subscription to DB:", err);
      });
    }

    return sub;
  }

  recordMeteredUsage(userId: string, units: number): UserSubscription | undefined {
    const sub = this.getUserSubscription(userId);
    if (!sub) return undefined;

    sub.meteredUsageUnits += units;
    sub.updatedAt = Date.now();
    this.subscriptions.set(sub.id, sub);

    if (this.db) {
      void this.db.execute(
        `UPDATE user_subscriptions SET metered_usage_units = ?, updated_at = ? WHERE id = ?`,
        [sub.meteredUsageUnits, sub.updatedAt, sub.id]
      ).catch((err) => {
        console.error("[Subscription] Failed to record metered usage in DB:", err);
      });
    }

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
