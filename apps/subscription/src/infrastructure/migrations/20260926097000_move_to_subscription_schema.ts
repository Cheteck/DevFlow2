import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "79e54eadfadbfcccbcbf28196dc36563531a07f51bd06ca2246378b0cf018428";
/* checksum:end */

/**
 * subscription.billing.v1.002 — move the 3 Subscription tables from `public`
 * into the dedicated `subscription` schema (no redundant prefix to strip).
 * Cross-schema FKs to shell-owned `public.user_subscriptions` keep working
 * (Postgres resolves FKs by OID, not by name).
 *
 * Data-preserving: SET SCHEMA moves rows, PKs, FKs, indexes and constraints
 * with the table. Postgres-only.
 *
 * The SchemaBuilder DSL cannot express `SET SCHEMA`: the DDL is therefore
 * declared explicitly as raw SQL (PostgreSQL only), the documented escape
 * hatch of the engine for dialect-specific DDL.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
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

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "coupons", clean: "coupons" },
  { legacy: "invoices", clean: "invoices" },
  { legacy: "metering_buckets", clean: "metering_buckets" },
];

export const migration: Migration = {
  id: "subscription.billing.v1.002_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["d14ded1cd85ac10b"],
  resources: MOVES.map((table) => `table:subscription.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("subscription");
    for (const table of MOVES) {
      context.schema.moveTableToSchema(table.legacy, "public", "subscription");
      // Same-name tables must NOT be renamed to themselves (Postgres error).
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema(
          "subscription",
          table.legacy,
          table.clean,
        );
      }
    }
  },
  downMigration: (context: MigrationContext) => {
    for (const table of [...MOVES].reverse()) {
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema(
          "subscription",
          table.clean,
          table.legacy,
        );
      }
      context.schema.moveTableToSchema(table.legacy, "subscription", "public");
    }
  },
};
