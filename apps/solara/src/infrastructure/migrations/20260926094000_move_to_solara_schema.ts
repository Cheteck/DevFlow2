import type { Migration, MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "e2a3119dcff7f75caf0dc891e3a3e31e84977287744d37d59300fdab8396a587";
/* checksum:end */

/**
 * solara.social.v1.002_move_to_schema
 *
 * Moves the six Solara tables from `public` into the dedicated `solara`
 * schema and strips the redundant prefix.
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table.
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
  { legacy: "solara_posts", clean: "posts" },
  { legacy: "solara_comments", clean: "comments" },
  { legacy: "solara_followers", clean: "followers" },
  { legacy: "solara_reactions", clean: "reactions" },
  { legacy: "solara_categories", clean: "categories" },
  { legacy: "solara_translations", clean: "translations" },
];

export const migration: Migration = {
  id: "solara.social.v1.002_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["7c3518b3ffb0081d"],
  resources: MOVES.map((table) => `table:solara.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("solara");
    for (const table of MOVES) {
      context.schema.moveTableToSchema(table.legacy, "public", "solara");
      context.schema.renameTableInSchema("solara", table.legacy, table.clean);
    }
  },
  downMigration: (context: MigrationContext) => {
    for (const table of [...MOVES].reverse()) {
      context.schema.renameTableInSchema("solara", table.clean, table.legacy);
      context.schema.moveTableToSchema(table.legacy, "solara", "public");
    }
  },
};
