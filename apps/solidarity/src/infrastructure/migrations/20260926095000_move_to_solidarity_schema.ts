import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "57db0c4465a770f9e4e7569c55a488fc90fc971024a29f37b7ef013bc3f87597";
/* checksum:end */

/**
 * solidarity.relief.v1.002 — move the 7 Solidarity tables from `public`
 * into the dedicated `solidarity` schema and strip the redundant prefix.
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
  { legacy: "solidarity_incidents", clean: "incidents" },
  { legacy: "solidarity_needs", clean: "needs" },
  { legacy: "solidarity_donations", clean: "donations" },
  { legacy: "solidarity_hubs", clean: "hubs" },
  { legacy: "solidarity_resources", clean: "resources" },
  { legacy: "solidarity_missions", clean: "missions" },
  { legacy: "solidarity_distributions", clean: "distributions" },
];

export const migration: Migration = {
  id: "solidarity.relief.v1.002_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["5cc8c0f371bbae40"],
  resources: MOVES.map((table) => `table:solidarity.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("solidarity");
    for (const table of MOVES) {
      context.schema.moveTableToSchema(table.legacy, "public", "solidarity");
      // Same-name tables must NOT be renamed to themselves (Postgres error).
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema(
          "solidarity",
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
          "solidarity",
          table.clean,
          table.legacy,
        );
      }
      context.schema.moveTableToSchema(table.legacy, "solidarity", "public");
    }
  },
};
