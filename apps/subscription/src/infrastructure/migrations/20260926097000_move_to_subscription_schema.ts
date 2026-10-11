import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * subscription.billing.v1.002 — move the 3 Subscription tables from `public`
 * into the dedicated `subscription` schema (no redundant prefix to strip).
 * Cross-schema FKs to shell-owned `public.user_subscriptions` keep working
 * (Postgres resolves FKs by OID, not by name).
 *
 * Data-preserving: SET SCHEMA moves rows, PKs, FKs, indexes and constraints
 * with the table. Postgres-only.
 */

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "coupons", clean: "coupons" },
  { legacy: "invoices", clean: "invoices" },
  { legacy: "metering_buckets", clean: "metering_buckets" },
];

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "subscription";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "subscription";`,
  );
  // Same-name tables must NOT be renamed to themselves (Postgres error).
  if (table.legacy !== table.clean) {
    upStatements.push(
      `ALTER TABLE IF EXISTS "subscription"."${table.legacy}" RENAME TO "${table.clean}";`,
    );
  }
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  if (table.legacy !== table.clean) {
    downStatements.push(
      `ALTER TABLE IF EXISTS "subscription"."${table.clean}" RENAME TO "${table.legacy}";`,
    );
  }
  downStatements.push(
    `ALTER TABLE IF EXISTS "subscription"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926097000_move_to_subscription_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:subscription.${table.clean}`),
};
