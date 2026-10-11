import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * commerce.shop.v1.003 — harden transactional integrity (critique schéma).
 *
 * Verified against the live DB before writing: parent tables are created
 * before dependents, indexes are valid, FKs present — the syntax/order
 * claims do NOT apply to our compiled migrations. This migration adds what
 * is REALLY missing, on the `commerce.*` names (v1.002):
 *
 * - Monetary/quantity guards: offers (price>0, stock>=0, commission 0..10000,
 *   ISO currency), auctions (starting>0, reserve>=starting, high>=0,
 *   endTime>startTime), bids (amount>0), cart_items (qty>0, unit>=0),
 *   payment_intents (received/refunded chains), orders (total/tax>=0).
 * - Payments: provider + providerPaymentId (UNIQUE) + idempotencyKey
 *   (UNIQUE) columns; DROP unused clientSecret (never written by code);
 *   new payment_refunds table (one row per refund, replaces the bare
 *   amountRefundedInCents aggregate).
 * - Orders: idempotencyKey (nullable) + partial UNIQUE for double-submit
 *   protection (enforced in OrderService.createOrder).
 * - cart_items.offerId → offers(id) FK (same BAC; no cross-BAC FKs by design).
 * - Missing UNIQUE(userId) on carts (declared v1.001 but never applied);
 *   drop redundant idx_carts_user (covered leftmost); add orders history
 *   index (userId, createdAt DESC) — the only live query path.
 * - DEFAULT now() on createdAt/updatedAt + set_updated_at trigger on the
 *   5 tables carrying updatedAt.
 *
 * Deliberately NOT changed (documented in docs/bacs/06-commerce.md):
 * single-vendable orders (code reality), NUMERIC order totals (Money VO
 * converts at the PSP boundary), per-table status vocabularies, no
 * (vendableId,sellerId) uniqueness (multi-offer is the model), carts.data
 * stays metadata-only, auction persistence stays in-memory (AUCTION-PERSIST
 * follow-up), no cross-BAC FKs to portfolio.vendables.
 *
 * Postgres-only (like v1.001/v1.002).
 */

const upStatements: string[] = [
  // v1.001 declared UNIQUE(userId) as a standalone unique INDEX (verified
  // live): only the redundant plain idx_carts_user (same leftmost column)
  // is dropped here.
  `DROP INDEX IF EXISTS "commerce"."idx_carts_user";`,

  // 2. Offer value guards.
  `ALTER TABLE "commerce"."offers" ADD CONSTRAINT "offers_values_check" CHECK ("priceInCents" > 0 AND "stockQuantity" >= 0 AND "commissionRateBps" BETWEEN 0 AND 10000);`,
  `ALTER TABLE "commerce"."offers" ADD CONSTRAINT "offers_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');`,

  // 3. Auction price/time guards.
  `ALTER TABLE "commerce"."auctions" ADD CONSTRAINT "auctions_price_check" CHECK ("startingPriceInCents" > 0 AND ("reservePriceInCents" IS NULL OR "reservePriceInCents" >= "startingPriceInCents") AND "currentHighBidInCents" >= 0);`,
  `ALTER TABLE "commerce"."auctions" ADD CONSTRAINT "auctions_time_check" CHECK ("endTime" > "startTime");`,
  `ALTER TABLE "commerce"."auction_bids" ADD CONSTRAINT "auction_bids_amount_check" CHECK ("amountInCents" > 0);`,

  // 4. Cart guards.
  `ALTER TABLE "commerce"."cart_items" ADD CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" > 0);`,
  `ALTER TABLE "commerce"."cart_items" ADD CONSTRAINT "cart_items_price_check" CHECK ("unitPriceInCents" >= 0);`,
  `ALTER TABLE "commerce"."cart_items" ADD CONSTRAINT "fk_commerce_cart_items_offerId" FOREIGN KEY ("offerId") REFERENCES "commerce"."offers" ("id");`,

  // 5. Payment hardening: provider refs + idempotency, drop unused secret.
  `ALTER TABLE "commerce"."payment_intents" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(64);`,
  `ALTER TABLE "commerce"."payment_intents" ADD COLUMN IF NOT EXISTS "providerPaymentId" VARCHAR(255);`,
  `ALTER TABLE "commerce"."payment_intents" ADD CONSTRAINT "uniq_payment_provider_id" UNIQUE ("provider", "providerPaymentId");`,
  `ALTER TABLE "commerce"."payment_intents" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(255);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_payment_intents_idempotency" ON "commerce"."payment_intents" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;`,
  `ALTER TABLE "commerce"."payment_intents" ADD CONSTRAINT "payment_intents_amounts_check" CHECK ("amountInCents" > 0 AND "amountReceivedInCents" >= 0 AND "amountRefundedInCents" >= 0 AND "amountReceivedInCents" <= "amountInCents" AND "amountRefundedInCents" <= "amountReceivedInCents");`,
  `ALTER TABLE "commerce"."payment_intents" ADD CONSTRAINT "payment_intents_status_check" CHECK ("status" IN ('requires_payment_method', 'requires_confirmation', 'processing', 'succeeded', 'canceled', 'partially_refunded', 'refunded'));`,
  `ALTER TABLE "commerce"."payment_intents" DROP COLUMN IF EXISTS "clientSecret";`,

  // 6. Refunds ledger (one row per refund; replaces the bare aggregate).
  `CREATE TABLE IF NOT EXISTS "commerce"."payment_refunds" ("id" VARCHAR(255) PRIMARY KEY, "paymentIntentId" VARCHAR(255) NOT NULL, "providerRefundId" VARCHAR(255), "amountInCents" INTEGER NOT NULL, "status" VARCHAR(32) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT "payment_refunds_amount_check" CHECK ("amountInCents" > 0), CONSTRAINT "fk_payment_refunds_intent" FOREIGN KEY ("paymentIntentId") REFERENCES "commerce"."payment_intents" ("id"));`,
  `CREATE INDEX IF NOT EXISTS "idx_payment_refunds_intent" ON "commerce"."payment_refunds" ("paymentIntentId");`,

  // 7. Orders: non-negative totals + idempotency column + history index.
  `ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_amounts_check" CHECK ("totalAmount" >= 0 AND "taxAmount" >= 0);`,
  `ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');`,
  `ALTER TABLE "commerce"."orders" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(255);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_orders_idempotency" ON "commerce"."orders" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS "idx_orders_user_created" ON "commerce"."orders" ("userId", "createdAt" DESC);`,

  // 8. Timestamp defaults (repos keep writing them explicitly).
  `ALTER TABLE "commerce"."orders" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."orders" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."offers" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."offers" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."payment_intents" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."payment_intents" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."auctions" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."auctions" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."carts" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."carts" ALTER COLUMN "updatedAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."cart_items" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "commerce"."auction_bids" ALTER COLUMN "createdAt" SET DEFAULT now();`,

  // 9. updatedAt auto-touch.
  `CREATE OR REPLACE FUNCTION "commerce"."set_updated_at"() RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS "trg_orders_updated_at" ON "commerce"."orders";`,
  `CREATE TRIGGER "trg_orders_updated_at" BEFORE UPDATE ON "commerce"."orders" FOR EACH ROW EXECUTE FUNCTION "commerce"."set_updated_at"();`,
  `DROP TRIGGER IF EXISTS "trg_offers_updated_at" ON "commerce"."offers";`,
  `CREATE TRIGGER "trg_offers_updated_at" BEFORE UPDATE ON "commerce"."offers" FOR EACH ROW EXECUTE FUNCTION "commerce"."set_updated_at"();`,
  `DROP TRIGGER IF EXISTS "trg_payment_intents_updated_at" ON "commerce"."payment_intents";`,
  `CREATE TRIGGER "trg_payment_intents_updated_at" BEFORE UPDATE ON "commerce"."payment_intents" FOR EACH ROW EXECUTE FUNCTION "commerce"."set_updated_at"();`,
  `DROP TRIGGER IF EXISTS "trg_auctions_updated_at" ON "commerce"."auctions";`,
  `CREATE TRIGGER "trg_auctions_updated_at" BEFORE UPDATE ON "commerce"."auctions" FOR EACH ROW EXECUTE FUNCTION "commerce"."set_updated_at"();`,
  `DROP TRIGGER IF EXISTS "trg_carts_updated_at" ON "commerce"."carts";`,
  `CREATE TRIGGER "trg_carts_updated_at" BEFORE UPDATE ON "commerce"."carts" FOR EACH ROW EXECUTE FUNCTION "commerce"."set_updated_at"();`,
];

const downStatements: string[] = [
  `DROP TRIGGER IF EXISTS "trg_carts_updated_at" ON "commerce"."carts";`,
  `DROP TRIGGER IF EXISTS "trg_auctions_updated_at" ON "commerce"."auctions";`,
  `DROP TRIGGER IF EXISTS "trg_payment_intents_updated_at" ON "commerce"."payment_intents";`,
  `DROP TRIGGER IF EXISTS "trg_offers_updated_at" ON "commerce"."offers";`,
  `DROP TRIGGER IF EXISTS "trg_orders_updated_at" ON "commerce"."orders";`,
  `DROP FUNCTION IF EXISTS "commerce"."set_updated_at"();`,
  `ALTER TABLE "commerce"."carts" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."carts" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."cart_items" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."auction_bids" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."auctions" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."auctions" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."payment_intents" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."payment_intents" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."offers" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."offers" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."orders" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "commerce"."orders" ALTER COLUMN "updatedAt" DROP DEFAULT;`,
  `DROP INDEX IF EXISTS "commerce"."idx_orders_user_created";`,
  `DROP INDEX IF EXISTS "commerce"."uniq_orders_idempotency";`,
  `ALTER TABLE "commerce"."orders" DROP COLUMN IF EXISTS "idempotencyKey";`,
  `ALTER TABLE "commerce"."orders" DROP CONSTRAINT IF EXISTS "orders_currency_check";`,
  `ALTER TABLE "commerce"."orders" DROP CONSTRAINT IF EXISTS "orders_amounts_check";`,
  `DROP INDEX IF EXISTS "commerce"."idx_payment_refunds_intent";`,
  `DROP TABLE IF EXISTS "commerce"."payment_refunds";`,
  `ALTER TABLE "commerce"."payment_intents" DROP CONSTRAINT IF EXISTS "payment_intents_status_check";`,
  `ALTER TABLE "commerce"."payment_intents" DROP CONSTRAINT IF EXISTS "payment_intents_amounts_check";`,
  `DROP INDEX IF EXISTS "commerce"."uniq_payment_intents_idempotency";`,
  `ALTER TABLE "commerce"."payment_intents" DROP CONSTRAINT IF EXISTS "uniq_payment_provider_id";`,
  `ALTER TABLE "commerce"."payment_intents" DROP COLUMN IF EXISTS "idempotencyKey";`,
  `ALTER TABLE "commerce"."payment_intents" DROP COLUMN IF EXISTS "providerPaymentId";`,
  `ALTER TABLE "commerce"."payment_intents" DROP COLUMN IF EXISTS "provider";`,
  `ALTER TABLE "commerce"."payment_intents" ADD COLUMN IF NOT EXISTS "clientSecret" VARCHAR(255);`,
  `ALTER TABLE "commerce"."cart_items" DROP CONSTRAINT IF EXISTS "fk_commerce_cart_items_offerId";`,
  `ALTER TABLE "commerce"."cart_items" DROP CONSTRAINT IF EXISTS "cart_items_price_check";`,
  `ALTER TABLE "commerce"."cart_items" DROP CONSTRAINT IF EXISTS "cart_items_quantity_check";`,
  `ALTER TABLE "commerce"."auction_bids" DROP CONSTRAINT IF EXISTS "auction_bids_amount_check";`,
  `ALTER TABLE "commerce"."auctions" DROP CONSTRAINT IF EXISTS "auctions_time_check";`,
  `ALTER TABLE "commerce"."auctions" DROP CONSTRAINT IF EXISTS "auctions_price_check";`,
  `ALTER TABLE "commerce"."offers" DROP CONSTRAINT IF EXISTS "offers_currency_check";`,
  `ALTER TABLE "commerce"."offers" DROP CONSTRAINT IF EXISTS "offers_values_check";`,
  `CREATE INDEX IF NOT EXISTS "idx_carts_user" ON "commerce"."carts" ("userId");`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926110000_harden_commerce",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: [
    "table:commerce.orders",
    "table:commerce.offers",
    "table:commerce.payment_intents",
    "table:commerce.payment_refunds",
    "table:commerce.auctions",
    "table:commerce.auction_bids",
    "table:commerce.carts",
    "table:commerce.cart_items",
  ],
};
