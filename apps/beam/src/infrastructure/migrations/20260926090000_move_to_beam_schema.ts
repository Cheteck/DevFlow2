import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "41c0923ac529f75a49048891214d704c923a89ea0e6dae9d1412978047d50eb3";
/* checksum:end */

/**
 * beam.messaging.v1.002 — move the 4 Beam tables from `public`
 * into the dedicated `beam` schema and strip the redundant prefix
 * (`beam.beam_messages` would stutter → `beam.messages`).
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table. Postgres-only.
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
  { legacy: "beam_conversations", clean: "conversations" },
  { legacy: "beam_messages", clean: "messages" },
  { legacy: "beam_notifications", clean: "notifications" },
  { legacy: "beam_push_subscriptions", clean: "push_subscriptions" },
];

export const migration: Migration = {
  id: "beam.messaging.v1.002_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["9c84024ca9173299"],
  resources: MOVES.map((table) => `table:beam.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("beam");
    for (const table of MOVES) {
      context.schema.moveTableToSchema(table.legacy, "public", "beam");
      // Same-name tables must NOT be renamed to themselves (Postgres error).
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema("beam", table.legacy, table.clean);
      }
    }
  },
  downMigration: (context: MigrationContext) => {
    for (const table of [...MOVES].reverse()) {
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema("beam", table.clean, table.legacy);
      }
      context.schema.moveTableToSchema(table.legacy, "beam", "public");
    }
  },
};
