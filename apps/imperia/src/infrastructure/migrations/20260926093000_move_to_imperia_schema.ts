import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "67a7c20529e66dd9ca0742c3d17f24c2188d98c6f6112257422635f06c247374";
/* checksum:end */

/**
 * imperia.ops.v1.002 — move the 5 Imperia tables from `public`
 * into the dedicated `imperia` schema and strip the redundant prefix.
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, indexes and
 * constraints with the table (no FKs in this BAC). Postgres-only.
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
  { legacy: "imperia_audit_logs", clean: "audit_logs" },
  { legacy: "imperia_policies", clean: "policies" },
  { legacy: "imperia_dlq", clean: "dlq" },
  { legacy: "imperia_circuit_breakers", clean: "circuit_breakers" },
  { legacy: "imperia_settings", clean: "settings" },
];

export const migration: Migration = {
  id: "imperia.ops.v1.002_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["be1dbd8f664c2695"],
  resources: MOVES.map((table) => `table:imperia.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("imperia");
    for (const table of MOVES) {
      context.schema.moveTableToSchema(table.legacy, "public", "imperia");
      // Same-name tables must NOT be renamed to themselves (Postgres error).
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema(
          "imperia",
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
          "imperia",
          table.clean,
          table.legacy,
        );
      }
      context.schema.moveTableToSchema(table.legacy, "imperia", "public");
    }
  },
};
