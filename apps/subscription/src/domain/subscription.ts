export type BillingInterval = "month" | "year";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "paused";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  interval: BillingInterval;
  features: string[];
  capabilitiesAllowed: string[];
  maxTenants?: number;
  meteredUnit?: string;
  meteredPricePerUnitInCents?: number;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  meteredUsageUnits: number;
  createdAt: number;
  updatedAt: number;
}
