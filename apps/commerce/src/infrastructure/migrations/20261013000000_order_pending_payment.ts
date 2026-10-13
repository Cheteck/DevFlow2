import { computeChecksum, type Migration } from "@mosaix/migrations";

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

const upStatements: string[] = [
  `ALTER TABLE IF EXISTS "commerce"."orders" DROP CONSTRAINT IF EXISTS "commerce_orders_status_check";`,
  `ALTER TABLE IF EXISTS "commerce"."orders" DROP CONSTRAINT IF EXISTS "orders_status_check";`,
  `ALTER TABLE IF EXISTS "public"."commerce_orders" DROP CONSTRAINT IF EXISTS "commerce_orders_status_check";`,
  `ALTER TABLE IF EXISTS "commerce"."orders" ADD CONSTRAINT "orders_status_check" CHECK ("status" IN (${FULL_VOCABULARY}));`,
];

const downStatements: string[] = [
  `ALTER TABLE IF EXISTS "commerce"."orders" DROP CONSTRAINT IF EXISTS "orders_status_check";`,
  `ALTER TABLE IF EXISTS "commerce"."orders" ADD CONSTRAINT "commerce_orders_status_check" CHECK ("status" IN ('Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'));`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20261013000000_order_pending_payment",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: ["table:commerce.orders"],
};
