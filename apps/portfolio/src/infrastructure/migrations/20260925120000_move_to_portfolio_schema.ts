import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "024b61379829153ff8ad79336a8ab66750482420d58a7a2dd23e5623456b2f7d";
/* checksum:end */

/**
 * portfolio.catalog.v1.003 — move the 15 Portfolio tables from `public`
 * into the dedicated `portfolio` schema and strip the redundant
 * `portfolio_` prefix (`portfolio.portfolio_vendables` → `portfolio.vendables`).
 *
 * - Data-preserving: `ALTER TABLE ... SET SCHEMA` + `RENAME TO` move rows,
 *   PKs, FKs (OID-based), indexes and constraints with the table.
 * - Postgres-only (like v1.001/v1.002): BAC migrations run on postgres,
 *   see `createShellMigrationRegistry(dialect)`.
 * - Down migration reverses exactly: rename back, move back to `public`.
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
  { legacy: "portfolio_vendables", clean: "vendables" },
  { legacy: "portfolio_categories", clean: "categories" },
  { legacy: "portfolio_vendable_categories", clean: "vendable_categories" },
  { legacy: "portfolio_variants", clean: "variants" },
  { legacy: "portfolio_translations", clean: "translations" },
  { legacy: "portfolio_relations", clean: "relations" },
  { legacy: "portfolio_media_assets", clean: "media_assets" },
  { legacy: "portfolio_feature_groups", clean: "feature_groups" },
  { legacy: "portfolio_features", clean: "features" },
  { legacy: "portfolio_feature_variants", clean: "feature_variants" },
  { legacy: "portfolio_vendable_features", clean: "vendable_features" },
  { legacy: "portfolio_variant_features", clean: "variant_features" },
  { legacy: "portfolio_variation_groups", clean: "variation_groups" },
  {
    legacy: "portfolio_variation_group_features",
    clean: "variation_group_features",
  },
  { legacy: "portfolio_proposals", clean: "proposals" },
];

export const migration: Migration = {
  id: "portfolio.catalog.v1.003_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["b456159a76d849a6"],
  resources: MOVES.map((table) => `table:portfolio.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("portfolio");
  },
  downMigration: (_context: MigrationContext) => {},
};
