import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "52a63ff57a177b438d7b280c9753a4fb84c426b571f2f3b38312a8491a86f776";
/* checksum:end */

/**
 * booking.scheduling.v1.002 — move the 4 Booking tables from `public`
 * into the dedicated `booking` schema and strip the redundant prefix.
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
  { legacy: "booking_slots", clean: "slots" },
  { legacy: "booking_reservations", clean: "reservations" },
  { legacy: "booking_waitlists", clean: "waitlists" },
  { legacy: "booking_reminders", clean: "reminders" },
];

export const migration: Migration = {
  id: "booking.scheduling.v1.002_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["ce39a45f37d4422f"],
  resources: MOVES.map((table) => `table:booking.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("booking");
    for (const table of MOVES) {
      context.schema.moveTableToSchema(table.legacy, "public", "booking");
      // Same-name tables must NOT be renamed to themselves (Postgres error).
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema(
          "booking",
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
          "booking",
          table.clean,
          table.legacy,
        );
      }
      context.schema.moveTableToSchema(table.legacy, "booking", "public");
    }
  },
};
