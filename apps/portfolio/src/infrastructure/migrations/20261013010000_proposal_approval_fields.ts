import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "3375bc4151ed0c8c7d9ddc78c7371e6d90de0f64412c9dc7994f686e30ae1c50";
/* checksum:end */

/**
 * portfolio.catalog.v1.007 — approval persistence for the vendor proposal saga.
 *
 * Restores the session work lost before a055b8e (V1.2): `approvedTerms` and
 * `auditTrail` (JSON), `approvedOfferId` and `idempotencyKey` on
 * `portfolio.proposals`. Idempotent (ADD COLUMN IF NOT EXISTS); the Postgres
 * repository hydrates missing columns with safe defaults, so the migration
 * can land before or after the code.
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

export const migration: Migration = {
  id: "portfolio.catalog.v1.007_approval_fields",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["458c225b8bec0495"],
  resources: [
    // v1.007_approval_fields AJOUTE des colonnes a portfolio.proposals
    // (ALTER TABLE ADD COLUMN). R9 exige au moins une ressource déclarée.
    "table:portfolio.proposals",
  ],
  up: (context: MigrationContext) => {
    context.schema.addColumn(
      { schema: "portfolio", name: "proposals" },
      "approvedTerms",
      "json",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "proposals" },
      "approvedOfferId",
      "text",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "proposals" },
      "idempotencyKey",
      "text",
      (col) => {
        col.nullable();
      },
      { ifNotExists: true },
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "proposals" },
      "auditTrail",
      "json",
      (col) => {
        col.default("[]");
      },
      { ifNotExists: true },
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropColumn(
      { schema: "portfolio", name: "proposals" },
      "auditTrail",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "proposals" },
      "idempotencyKey",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "proposals" },
      "approvedOfferId",
      { ifExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "proposals" },
      "approvedTerms",
      { ifExists: true },
    );
  },
};
