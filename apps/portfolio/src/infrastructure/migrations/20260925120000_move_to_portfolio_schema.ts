import { computeChecksum, type Migration } from "@mosaix/migrations";

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
  { legacy: "portfolio_variation_group_features", clean: "variation_group_features" },
  { legacy: "portfolio_proposals", clean: "proposals" },
];

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "portfolio";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "portfolio";`,
    `ALTER TABLE IF EXISTS "portfolio"."${table.legacy}" RENAME TO "${table.clean}";`,
  );
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  downStatements.push(
    `ALTER TABLE IF EXISTS "portfolio"."${table.clean}" RENAME TO "${table.legacy}";`,
    `ALTER TABLE IF EXISTS "portfolio"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260925120000_move_to_portfolio_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:portfolio.${table.clean}`),
};
