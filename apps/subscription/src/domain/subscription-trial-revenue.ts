import type { Subscription } from "./subscription.model.js";

export class SubscriptionTrialManager {
  static createTrial(tenantId: string, planId: string, durationDays: number = 14): {
    tenantId: string;
    planId: string;
    trialStart: string;
    trialEnd: string;
    requiresCreditCard: boolean;
  } {
    const now = new Date();
    const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    return {
      tenantId,
      planId,
      trialStart: now.toISOString(),
      trialEnd: end.toISOString(),
      requiresCreditCard: false,
    };
  }

  static extendTrial(currentEndIso: string, additionalDays: number): string {
    const current = new Date(currentEndIso);
    return new Date(current.getTime() + additionalDays * 24 * 60 * 60 * 1000).toISOString();
  }
}

export class RevenueRecognitionEngine {
  static computeMetrics(subscriptions: Subscription[], monthlyPricePerSubEur: number = 29): {
    activeCount: number;
    mrrEur: number;
    arrEur: number;
    churnRate: number;
  } {
    const active = subscriptions.filter((s) => s.status === "ACTIVE");
    const cancelled = subscriptions.filter((s) => s.status === "CANCELLED");

    const mrr = active.length * monthlyPricePerSubEur;
    const arr = mrr * 12;
    const total = subscriptions.length;
    const churnRate = total > 0 ? Math.round((cancelled.length / total) * 100) / 100 : 0;

    return {
      activeCount: active.length,
      mrrEur: mrr,
      arrEur: arr,
      churnRate,
    };
  }
}
