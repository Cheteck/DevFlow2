import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "97af9c985b20850b168dd380cf8e08501ed5db851bbc661161aa05f98fa49f31";
/* checksum:end */

/**
 * commerce.shop.v1.004 — extend the orders status vocabulary with `PendingPayment`.
 *
 * Restores the session work lost before a055b8e (V1.1): orders settle to
 * `PendingPayment` after saga authorization and confirm to `Paid` via webhook.
 *
 * Defensive: drops the auto-named CHECKs from both the pre- and post-schema-move
 * table names (constraints move with the table, so only the creation-time name
 * matters), then re-adds the full vocabulary under an explicit name.
 * Idempotent on re-run; existing rows are untouched (no backfill: legacy
 * `Pending` orders keep working via the machine's LEGACY_EDGES).
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

const FULL_VOCABULARY = [
  "Pending",
  "PendingPayment",
  "Paid",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Refunded",
]
  .map((v) => `'${v}'`)
  .join(", ");

export const migration: Migration = {
  id: "commerce.shop.v1.004_order_pending_payment",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["e3adfda034ff2943"],
  resources: [
    // v1.004_order_pending_payment MODIFIE commerce.orders (ajoute contrainte CHECK status).
    // R9 exige au moins une ressource déclarée pour la détection de collisions.
    "table:commerce.orders",
  ],
  up: (context: MigrationContext) => {
    context.schema.dropConstraint(
      { schema: "commerce", name: "orders" },
      "commerce_orders_status_check",
      { ifExists: true },
    );
    context.schema.dropConstraint(
      { schema: "commerce", name: "orders" },
      "orders_status_check",
      { ifExists: true },
    );
    context.schema.dropConstraint(
      { schema: "public", name: "commerce_orders" },
      "commerce_orders_status_check",
      { ifExists: true },
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "orders" },
      "orders_status_check",
      `CHECK ("status" IN (${FULL_VOCABULARY}))`,
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropConstraint(
      { schema: "commerce", name: "orders" },
      "orders_status_check",
      { ifExists: true },
    );
    context.schema.addConstraint(
      { schema: "commerce", name: "orders" },
      "commerce_orders_status_check",
      "CHECK (\"status\" IN ('Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'))",
    );
  },
};
