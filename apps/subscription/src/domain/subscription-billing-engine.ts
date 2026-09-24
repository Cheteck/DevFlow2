import type { SubscriptionPlan, UserSubscription } from "./subscription.js";

export interface Coupon {
  code: string;
  discountType: "percent" | "fixed_amount";
  discountValue: number; // e.g. 20 for 20% or 500 for 5.00€ in cents
  currency?: string;
  validUntil?: number;
  maxRedemptions?: number;
  redemptionsCount: number;
  firstOrderOnly?: boolean;
}

export interface ProrationResult {
  previousPlanRefundInCents: number;
  newPlanChargeInCents: number;
  netDueInCents: number;
  remainingDays: number;
  totalDaysInPeriod: number;
}

/**
 * High-Precision Proration Calculator for Mid-Cycle Plan Upgrades / Downgrades
 */
export class ProrationCalculator {
  static calculate(
    subscription: UserSubscription,
    currentPlan: SubscriptionPlan,
    newPlan: SubscriptionPlan,
    effectiveTimestamp: number = Date.now(),
  ): ProrationResult {
    const totalPeriodMs = Math.max(1, subscription.currentPeriodEnd - subscription.currentPeriodStart);
    const remainingMs = Math.max(0, subscription.currentPeriodEnd - effectiveTimestamp);

    const totalDays = Math.ceil(totalPeriodMs / (24 * 3600 * 1000));
    const remainingDays = Math.ceil(remainingMs / (24 * 3600 * 1000));
    const ratio = Math.min(1, Math.max(0, remainingMs / totalPeriodMs));

    // Refund unused portion of old plan
    const previousPlanRefundInCents = Math.round(currentPlan.priceInCents * ratio);
    // Charge prorated portion of new plan
    const newPlanChargeInCents = Math.round(newPlan.priceInCents * ratio);
    // Net amount due (or credit note if negative)
    const netDueInCents = newPlanChargeInCents - previousPlanRefundInCents;

    return {
      previousPlanRefundInCents,
      newPlanChargeInCents,
      netDueInCents,
      remainingDays,
      totalDaysInPeriod: totalDays,
    };
  }
}

/**
 * Automated Dunning Retry Schedule Manager
 * Schedule: Day 1 (retry), Day 3 (retry + notice), Day 7 (warning), Day 14 (pause)
 */
export type DunningAction = "retry_charge" | "send_reminder_email" | "pause_service" | "cancel_subscription";

export interface DunningStep {
  dayOffset: number;
  action: DunningAction;
  notificationMessage: string;
}

export class DunningScheduleManager {
  private static readonly SCHEDULE: DunningStep[] = [
    { dayOffset: 1, action: "retry_charge", notificationMessage: "Premier essai de débit échoué. Nouvelle tentative automatique." },
    { dayOffset: 3, action: "retry_charge", notificationMessage: "Échec récurrent de paiement. Mise à jour de votre moyen de paiement requise." },
    { dayOffset: 7, action: "send_reminder_email", notificationMessage: "Dernier avis avant suspension de votre forfait sous 7 jours." },
    { dayOffset: 14, action: "pause_service", notificationMessage: "Forfait suspendu pour défaut de règlement." },
  ];

  static getSteps(): DunningStep[] {
    return [...this.SCHEDULE];
  }

  static getActionForDaysPastDue(daysPastDue: number): DunningStep | null {
    const applicable = this.SCHEDULE.filter((s) => s.dayOffset <= daysPastDue);
    return applicable.length > 0 ? applicable[applicable.length - 1] : null;
  }
}

/**
 * Real-Time Hourly Metering Aggregator
 */
export class HourlyMeteringAggregator {
  // key: `${userId}:${planId}:${yyyy-mm-dd-hh}` -> count
  private hourlyCounts = new Map<string, number>();

  recordUsage(userId: string, planId: string, units: number = 1, timestamp: number = Date.now()): void {
    const date = new Date(timestamp);
    const bucket = `${userId}:${planId}:${date.toISOString().slice(0, 13)}`;
    const current = this.hourlyCounts.get(bucket) ?? 0;
    this.hourlyCounts.set(bucket, current + units);
  }

  getHourlyUsage(userId: string, planId: string, timestamp: number = Date.now()): number {
    const date = new Date(timestamp);
    const bucket = `${userId}:${planId}:${date.toISOString().slice(0, 13)}`;
    return this.hourlyCounts.get(bucket) ?? 0;
  }

  aggregatePeriod(userId: string, planId: string, startTimestamp: number, endTimestamp: number): number {
    let total = 0;
    for (const [bucket, count] of this.hourlyCounts.entries()) {
      if (bucket.startsWith(`${userId}:${planId}:`)) {
        const hourIso = bucket.split(":")[2] + ":00:00.000Z";
        const hourTime = new Date(hourIso).getTime();
        if (hourTime >= startTimestamp && hourTime <= endTimestamp) {
          total += count;
        }
      }
    }
    return total;
  }
}
