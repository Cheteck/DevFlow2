import {
  func,
  isNotNull,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "3b14a53929ed6276d2f44fb17f45d368cbe12933efc7b25129c8bd2646734c6e";
/* checksum:end */

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
  id: "commerce.shop.v1.003_harden_commerce",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["cb883bf41326700b"],
  resources: [
    // v1.003_harden_commerce MODIFIE ces tables existantes et CREATE payment_refunds.
    // R9 exige au moins une ressource déclarée pour la détection de collisions.
    "table:commerce.offers",
    "table:commerce.auctions",
    "table:commerce.auction_bids",
    "table:commerce.carts",
    "table:commerce.cart_items",
    "table:commerce.payment_intents",
    "table:commerce.payment_refunds",
    "table:commerce.orders",
  ],
  up: (context: MigrationContext) => {
    context.schema.dropIndex("idx_carts_user", "commerce");
    context.schema.addConstraint(
      { schema: "commerce", name: "offers" },
      "offers_values_check",
      'CHECK ("priceInCents" > 0 AND "stockQuantity" >= 0 AND "commissionRateBps" BETWEEN 0 AND 10000)',
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "offers" },
      "offers_currency_check",
      "CHECK (\"currency\" ~ '^[A-Z]{3}$')",
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "auctions" },
      "auctions_price_check",
      'CHECK ("startingPriceInCents" > 0 AND ("reservePriceInCents" IS NULL OR "reservePriceInCents" >= "startingPriceInCents") AND "currentHighBidInCents" >= 0)',
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "auctions" },
      "auctions_time_check",
      'CHECK ("endTime" > "startTime")',
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "auction_bids" },
      "auction_bids_amount_check",
      'CHECK ("amountInCents" > 0)',
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "cart_items" },
      "cart_items_quantity_check",
      'CHECK ("quantity" > 0)',
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "cart_items" },
      "cart_items_price_check",
      'CHECK ("unitPriceInCents" >= 0)',
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "cart_items" },
      "fk_commerce_cart_items_offerId",
      'FOREIGN KEY ("offerId") REFERENCES "commerce"."offers" ("id")',
    );
    context.schema.addColumn(
      { schema: "commerce", name: "payment_intents" },
      "provider",
      "string",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true, length: 64 },
    );
    context.schema.addColumn(
      { schema: "commerce", name: "payment_intents" },
      "providerPaymentId",
      "string",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true, length: 255 },
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "payment_intents" },
      "uniq_payment_provider_id",
      'UNIQUE ("provider", "providerPaymentId")',
    );
    context.schema.addColumn(
      { schema: "commerce", name: "payment_intents" },
      "idempotencyKey",
      "string",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true, length: 255 },
    );
    context.schema.createIndex(
      { schema: "commerce", name: "payment_intents" },
      "uniq_payment_intents_idempotency",
      [{ name: "idempotencyKey" }],
      { unique: true, ifNotExists: true, where: [isNotNull("idempotencyKey")] },
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "payment_intents" },
      "payment_intents_amounts_check",
      'CHECK ("amountInCents" > 0 AND "amountReceivedInCents" >= 0 AND "amountRefundedInCents" >= 0 AND "amountReceivedInCents" <= "amountInCents" AND "amountRefundedInCents" <= "amountReceivedInCents")',
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "payment_intents" },
      "payment_intents_status_check",
      "CHECK (\"status\" IN ('requires_payment_method', 'requires_confirmation', 'processing', 'succeeded', 'canceled', 'partially_refunded', 'refunded'))",
    );
    context.schema.dropColumn(
      { schema: "commerce", name: "payment_intents" },
      "clientSecret",
      { ifExists: true },
    );
    context.schema.createTable(
      "payment_refunds",
      (table) => {
        table.string("id", 255).primary();
        table.string("paymentIntentId", 255);
        table.string("providerRefundId", 255).nullable();
        table.integer("amountInCents");
        table.string("status", 32).default("pending");
        table.timestamp("createdAt").default(func("now"));
        table.timestamp("updatedAt").default(func("now"));
        table.check("payment_refunds_amount_check", '"amountInCents" > 0');
        table.constraint(
          "fk_payment_refunds_intent",
          'FOREIGN KEY ("paymentIntentId") REFERENCES "commerce"."payment_intents" ("id")',
        );
      },
      { ifNotExists: true, schema: "commerce" },
    );
    context.schema.createIndex(
      { schema: "commerce", name: "payment_refunds" },
      "idx_payment_refunds_intent",
      [{ name: "paymentIntentId" }],
      { ifNotExists: true },
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "orders" },
      "orders_amounts_check",
      'CHECK ("totalAmount" >= 0 AND "taxAmount" >= 0)',
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "orders" },
      "orders_currency_check",
      "CHECK (\"currency\" ~ '^[A-Z]{3}$')",
    );
    context.schema.addColumn(
      { schema: "commerce", name: "orders" },
      "idempotencyKey",
      "string",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true, length: 255 },
    );
    context.schema.createIndex(
      { schema: "commerce", name: "orders" },
      "uniq_orders_idempotency",
      [{ name: "idempotencyKey" }],
      { unique: true, ifNotExists: true, where: [isNotNull("idempotencyKey")] },
    );
    context.schema.createIndex(
      { schema: "commerce", name: "orders" },
      "idx_orders_user_created",
      [{ name: "userId" }, { name: "createdAt", direction: "desc" }],
      { ifNotExists: true },
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "orders" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "orders" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "offers" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "offers" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "payment_intents" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "payment_intents" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "auctions" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "auctions" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "carts" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "carts" },
      "updatedAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "cart_items" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "auction_bids" },
      "createdAt",
      func("now"),
    );
    context.schema.createFunction(
      "set_updated_at",
      ' BEGIN NEW."updatedAt" = now(); RETURN NEW; END; ',
      {
        schema: "commerce",
        returns: "TRIGGER",
        language: "plpgsql",
        replace: true,
      },
    );
    context.schema.dropTrigger("trg_orders_updated_at", "orders", {
      schema: "commerce",
    });
    context.schema.createTrigger(
      "trg_orders_updated_at",
      "orders",
      ["update"],
      "before",
      "set_updated_at",
      { schema: "commerce", functionSchema: "commerce" },
    );
    context.schema.dropTrigger("trg_offers_updated_at", "offers", {
      schema: "commerce",
    });
    context.schema.createTrigger(
      "trg_offers_updated_at",
      "offers",
      ["update"],
      "before",
      "set_updated_at",
      { schema: "commerce", functionSchema: "commerce" },
    );
    context.schema.dropTrigger(
      "trg_payment_intents_updated_at",
      "payment_intents",
      { schema: "commerce" },
    );
    context.schema.createTrigger(
      "trg_payment_intents_updated_at",
      "payment_intents",
      ["update"],
      "before",
      "set_updated_at",
      { schema: "commerce", functionSchema: "commerce" },
    );
    context.schema.dropTrigger("trg_auctions_updated_at", "auctions", {
      schema: "commerce",
    });
    context.schema.createTrigger(
      "trg_auctions_updated_at",
      "auctions",
      ["update"],
      "before",
      "set_updated_at",
      { schema: "commerce", functionSchema: "commerce" },
    );
    context.schema.dropTrigger("trg_carts_updated_at", "carts", {
      schema: "commerce",
    });
    context.schema.createTrigger(
      "trg_carts_updated_at",
      "carts",
      ["update"],
      "before",
      "set_updated_at",
      { schema: "commerce", functionSchema: "commerce" },
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTrigger("trg_carts_updated_at", "carts", {
      schema: "commerce",
    });
    context.schema.dropTrigger("trg_auctions_updated_at", "auctions", {
      schema: "commerce",
    });
    context.schema.dropTrigger(
      "trg_payment_intents_updated_at",
      "payment_intents",
      { schema: "commerce" },
    );
    context.schema.dropTrigger("trg_offers_updated_at", "offers", {
      schema: "commerce",
    });
    context.schema.dropTrigger("trg_orders_updated_at", "orders", {
      schema: "commerce",
    });
    context.schema.dropFunction("set_updated_at", { schema: "commerce" });
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "carts" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "carts" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "cart_items" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "auction_bids" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "auctions" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "auctions" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "payment_intents" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "payment_intents" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "offers" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "offers" },
      "updatedAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "orders" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { schema: "commerce", name: "orders" },
      "updatedAt",
    );
    context.schema.dropIndex("idx_orders_user_created", "commerce");
    context.schema.dropIndex("uniq_orders_idempotency", "commerce");
    context.schema.dropColumn(
      { schema: "commerce", name: "orders" },
      "idempotencyKey",
      { ifExists: true },
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "orders" },
      "orders_currency_check",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "orders" },
      "orders_amounts_check",
    );
    context.schema.dropIndex("idx_payment_refunds_intent", "commerce");
    context.schema.dropTable(
      { schema: "commerce", name: "payment_refunds" },
      { ifExists: true, schema: "commerce" },
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "payment_intents" },
      "payment_intents_status_check",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "payment_intents" },
      "payment_intents_amounts_check",
    );
    context.schema.dropIndex("uniq_payment_intents_idempotency", "commerce");
    context.schema.dropConstraint(
      { schema: "commerce", name: "payment_intents" },
      "uniq_payment_provider_id",
    );
    context.schema.dropColumn(
      { schema: "commerce", name: "payment_intents" },
      "idempotencyKey",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "commerce", name: "payment_intents" },
      "providerPaymentId",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "commerce", name: "payment_intents" },
      "provider",
      { ifExists: true },
    );
    context.schema.addColumn(
      { schema: "commerce", name: "payment_intents" },
      "clientSecret",
      "string",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true, length: 255 },
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "cart_items" },
      "fk_commerce_cart_items_offerId",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "cart_items" },
      "cart_items_price_check",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "cart_items" },
      "cart_items_quantity_check",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "auction_bids" },
      "auction_bids_amount_check",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "auctions" },
      "auctions_time_check",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "auctions" },
      "auctions_price_check",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "offers" },
      "offers_currency_check",
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "offers" },
      "offers_values_check",
    );
    context.schema.createIndex(
      { schema: "commerce", name: "carts" },
      "idx_carts_user",
      [{ name: "userId" }],
      { ifNotExists: true },
    );
  },
};
