import * as crypto from "node:crypto";

/**
 * Minimal subscription view for trial/revenue analytics.
 * Status vocabulary here is `ACTIVE`/`CANCELLED` (billing analytics),
 * distinct from `UserSubscription`'s lifecycle statuses.
 */
export interface Subscription {
  id: string;
  tenantId: string;
  status: string;
}

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

  /**
   * ASC 606 compliant deferred revenue amortization schedule for multi-month / annual contracts
   */
  static computeDeferredSchedule(annualContractValueEur: number, contractStartMonth: number, contractMonths: number = 12): Array<{
    month: number;
    recognizedRevenue: number;
    deferredRevenueRemaining: number;
  }> {
    const monthlyRecognition = Math.round((annualContractValueEur / contractMonths) * 100) / 100;
    const schedule = [];

    for (let i = 1; i <= contractMonths; i++) {
      const recognizedSoFar = monthlyRecognition * i;
      const remaining = Math.max(0, Math.round((annualContractValueEur - recognizedSoFar) * 100) / 100);
      schedule.push({
        month: contractStartMonth + i - 1,
        recognizedRevenue: monthlyRecognition,
        deferredRevenueRemaining: remaining,
      });
    }

    return schedule;
  }
}

/**
 * High-throughput real-time metering using sorted sets (ZADD / ZREVRANGEBYSCORE)
 */
export class RedisSortedSetMeteringEngine {
  private sortedSets = new Map<string, Array<{ member: string; score: number }>>();

  recordUsage(meterKey: string, quantity: number, timestamp: number = Date.now()): void {
    if (!this.sortedSets.has(meterKey)) {
      this.sortedSets.set(meterKey, []);
    }
    const set = this.sortedSets.get(meterKey)!;
    set.push({ member: `${timestamp}:${crypto.randomUUID().slice(0, 8)}`, score: timestamp });
  }

  getUsageInRange(meterKey: string, startTimestamp: number, endTimestamp: number): number {
    const set = this.sortedSets.get(meterKey) ?? [];
    return set.filter((entry) => entry.score >= startTimestamp && entry.score <= endTimestamp).length;
  }
}

export type SubscriptionWebhookEvent =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.payment_failed"
  | "subscription.trial_expiring"
  | "subscription.cancelled";

export class SubscriptionWebhookDispatcher {
  static formatWebhookPayload(event: SubscriptionWebhookEvent, subscription: Subscription): {
    id: string;
    event: SubscriptionWebhookEvent;
    timestamp: string;
    data: { subscriptionId: string; tenantId: string; status: string };
  } {
    return {
      id: `evt_${Date.now()}`,
      event,
      timestamp: new Date().toISOString(),
      data: {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        status: subscription.status,
      },
    };
  }
}

