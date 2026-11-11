import {
  func,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "f154b0a6b64fca09cc09bc7888879905d6c40d0ce1ac4ee8be76590d36080f66";
/* checksum:end */

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
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the PostgreSQL grammar and executes the resulting
 * statements. No SQL string is carried by the migration.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */

export const migration: Migration = {
  id: "subscription.billing.v1.003_harden_billing",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["345a7f4f1f2ccfdd"],
  resources: [
    // v1.003_harden_billing MODIFIE des tables existantes (coupons, invoices,
    // metering_buckets).
    // R9 exige au moins une ressource déclarée pour la détection de collisions.
    "table:subscription.coupons",
    "table:subscription.invoices",
    "table:subscription.metering_buckets",
  ],
  up: (context: MigrationContext) => {
    context.schema.addConstraint(
      { schema: "subscription", name: "coupons" },
      "coupons_percent_check",
      'CHECK ("discountPercent" IS NULL OR ("discountPercent" BETWEEN 0 AND 100))',
    );
    context.schema.addConstraint(
      { schema: "subscription", name: "coupons" },
      "coupons_amount_check",
      'CHECK ("discountAmountInCents" IS NULL OR "discountAmountInCents" >= 0)',
    );
    context.schema.addConstraint(
      { schema: "subscription", name: "coupons" },
      "coupons_redemptions_check",
      'CHECK ("maxRedemptions" >= 0 AND "redemptionsCount" >= 0 AND "redemptionsCount" <= "maxRedemptions")',
    );
    context.schema.addConstraint(
      { schema: "subscription", name: "metering_buckets" },
      "metering_bucket_unique",
      'UNIQUE ("subscriptionId", "metric", "bucketTimestamp")',
    );
    context.schema.addConstraint(
      { schema: "subscription", name: "metering_buckets" },
      "metering_units_check",
      'CHECK ("units" >= 0)',
    );
    context.schema.addConstraint(
      { schema: "subscription", name: "invoices" },
      "invoices_amount_check",
      'CHECK ("amountInCents" >= 0)',
    );
    context.schema.addConstraint(
      { schema: "subscription", name: "invoices" },
      "invoices_currency_check",
      "CHECK (\"currency\" ~ '^[A-Z]{3}$')",
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "invoices" },
      "fk_invoices_subscriptionId",
    );
    context.schema.addConstraint(
      { schema: "subscription", name: "invoices" },
      "fk_invoices_subscriptionId",
      'FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions" ("id") ON DELETE RESTRICT',
    );
    context.schema.alterColumnDefault(
      { schema: "subscription", name: "coupons" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "subscription", name: "invoices" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "subscription", name: "metering_buckets" },
      "createdAt",
      func("now"),
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.alterColumnDefault(
      { schema: "subscription", name: "metering_buckets" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "subscription", name: "invoices" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "subscription", name: "coupons" },
      "createdAt",
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "invoices" },
      "fk_invoices_subscriptionId",
    );
    context.schema.addConstraint(
      { schema: "subscription", name: "invoices" },
      "fk_invoices_subscriptionId",
      'FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions" ("id") ON DELETE CASCADE',
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "invoices" },
      "invoices_currency_check",
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "invoices" },
      "invoices_amount_check",
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "metering_buckets" },
      "metering_units_check",
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "metering_buckets" },
      "metering_bucket_unique",
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "coupons" },
      "coupons_redemptions_check",
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "coupons" },
      "coupons_amount_check",
    );
    context.schema.dropConstraint(
      { schema: "subscription", name: "coupons" },
      "coupons_percent_check",
    );
  },
};
