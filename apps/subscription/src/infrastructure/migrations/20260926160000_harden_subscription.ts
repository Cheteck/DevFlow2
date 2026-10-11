import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * subscription.billing.v1.003 — harden billing integrity (critique schéma).
 *
 * Verified against the live DB before writing: PKs exist on all 3 tables,
 * creation order is correct — the missing-PK claims do NOT apply to our
 * compiled migrations. This migration adds what is REALLY missing:
 *
 * - coupons: percent/amount/counts coherence CHECKs (maxRedemptions stays
 *   NOT NULL DEFAULT 100: 0 means "no redemption allowed"; unlimited is
 *   expressed with a high cap, documented).
 * - metering_buckets: UNIQUE(subscriptionId,metric,bucketTimestamp) so a
 *   consumption period is never double-counted; units fenced >= 0.
 * - invoices: amount/currency guards; subscription FK CASCADE → RESTRICT
 *   (accounting history must survive subscription deletion — archive the
 *   subscription instead of deleting it).
 * - DEFAULT now() on createdAt.
 *
 * Deliberately NOT changed (documented in docs/bacs/10-subscription.md):
 * no coupon-usage ledger table (no redemption path writes redemptionsCount
 * yet — usage table comes with the redeem flow); no stable invoice number
 * beyond id (uuid, unique by PK); multi-tenant scoping deferred with the
 * platform tenant decision (same as other BACs).
 *
 * Postgres-only.
 */

const upStatements: string[] = [
  // 1. Coupons: value coherence (NULL allowed only where the model allows it).
  `ALTER TABLE "subscription"."coupons" ADD CONSTRAINT "coupons_percent_check" CHECK ("discountPercent" IS NULL OR ("discountPercent" BETWEEN 0 AND 100));`,
  `ALTER TABLE "subscription"."coupons" ADD CONSTRAINT "coupons_amount_check" CHECK ("discountAmountInCents" IS NULL OR "discountAmountInCents" >= 0);`,
  `ALTER TABLE "subscription"."coupons" ADD CONSTRAINT "coupons_redemptions_check" CHECK ("maxRedemptions" >= 0 AND "redemptionsCount" >= 0 AND "redemptionsCount" <= "maxRedemptions");`,

  // 2. Metering: one bucket per subscription, metric and period.
  `ALTER TABLE "subscription"."metering_buckets" ADD CONSTRAINT "metering_bucket_unique" UNIQUE ("subscriptionId", "metric", "bucketTimestamp");`,
  `ALTER TABLE "subscription"."metering_buckets" ADD CONSTRAINT "metering_units_check" CHECK ("units" >= 0);`,

  // 3. Invoices: non-negative amounts, ISO currency, history-preserving FK.
  `ALTER TABLE "subscription"."invoices" ADD CONSTRAINT "invoices_amount_check" CHECK ("amountInCents" >= 0);`,
  `ALTER TABLE "subscription"."invoices" ADD CONSTRAINT "invoices_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');`,
  `ALTER TABLE "subscription"."invoices" DROP CONSTRAINT IF EXISTS "fk_invoices_subscriptionId";`,
  `ALTER TABLE "subscription"."invoices" ADD CONSTRAINT "fk_invoices_subscriptionId" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions" ("id") ON DELETE RESTRICT;`,

  // 4. Timestamp defaults (repos keep writing them explicitly).
  `ALTER TABLE "subscription"."coupons" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "subscription"."invoices" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "subscription"."metering_buckets" ALTER COLUMN "createdAt" SET DEFAULT now();`,
];

const downStatements: string[] = [
  `ALTER TABLE "subscription"."metering_buckets" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "subscription"."invoices" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "subscription"."coupons" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "subscription"."invoices" DROP CONSTRAINT IF EXISTS "fk_invoices_subscriptionId";`,
  `ALTER TABLE "subscription"."invoices" ADD CONSTRAINT "fk_invoices_subscriptionId" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions" ("id") ON DELETE CASCADE;`,
  `ALTER TABLE "subscription"."invoices" DROP CONSTRAINT IF EXISTS "invoices_currency_check";`,
  `ALTER TABLE "subscription"."invoices" DROP CONSTRAINT IF EXISTS "invoices_amount_check";`,
  `ALTER TABLE "subscription"."metering_buckets" DROP CONSTRAINT IF EXISTS "metering_units_check";`,
  `ALTER TABLE "subscription"."metering_buckets" DROP CONSTRAINT IF EXISTS "metering_bucket_unique";`,
  `ALTER TABLE "subscription"."coupons" DROP CONSTRAINT IF EXISTS "coupons_redemptions_check";`,
  `ALTER TABLE "subscription"."coupons" DROP CONSTRAINT IF EXISTS "coupons_amount_check";`,
  `ALTER TABLE "subscription"."coupons" DROP CONSTRAINT IF EXISTS "coupons_percent_check";`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926160000_harden_subscription",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: [
    "table:subscription.coupons",
    "table:subscription.invoices",
    "table:subscription.metering_buckets",
  ],
};
