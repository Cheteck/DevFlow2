import {
  column,
  isNull,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "48dea81e5284cd1a78b34556173384a33b03dba54b0fa8eca1dda268425a28b6";
/* checksum:end */

/**
 * portfolio.catalog.v1.008 — add tenant_id column to portfolio.vendables
 * and portfolio.proposals for multi-tenant isolation.
 *
 * Canonical id `portfolio.catalog.v1.008_tenant_id` (v1.004 is already
 * taken by `portfolio.catalog.v1.004_harden_data_integrity`; the registry
 * sorts migrations by 4-part id, so this must be the next free version).
 *
 * Strategy:
 * 1. Add tenant_id as nullable first
 * 2. Backfill existing rows with 'legacy' placeholder (to be cleaned by operator)
 * 3. Add NOT NULL constraint
 * 4. Change UNIQUE(reference) to UNIQUE(tenant_id, reference)
 * 5. Add index on tenant_id
 *
 * The 'legacy' placeholder ensures existing data isn't lost; operators must
 * update it to the correct tenant before relying on isolation.
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
  id: "portfolio.catalog.v1.008_tenant_id",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["f1ffd4ef8f86c1f0"],
  resources: [
    // v1.008_tenant_id MODIFIE portfolio.vendables et portfolio.proposals
    // (ADD COLUMN tenant_id, ALTER COLUMN, ADD CONSTRAINT, CREATE INDEX).
    // R9 exige au moins une ressource déclarée pour la détection de collisions.
    "table:portfolio.vendables",
    "table:portfolio.proposals",
  ],
  up: (context: MigrationContext) => {
    context.schema.addColumn(
      { schema: "portfolio", name: "vendables" },
      "tenant_id",
      "text",
      (col) => {
        col.nullable();
      },
    );
    context.data.update(
      { schema: "portfolio", name: "vendables" },
      { tenant_id: column("id") },
      [isNull("tenant_id")],
    );
    context.schema.alterColumnNullable(
      { schema: "portfolio", name: "vendables" },
      "tenant_id",
      false,
    );
    context.schema.dropIndex("uniq_vendable_reference", "portfolio");
    context.schema.addConstraint(
      { schema: "portfolio", name: "vendables" },
      "uniq_vendable_tenant_reference",
      'UNIQUE ("tenant_id", "reference")',
    );
    context.schema.createIndex(
      { schema: "portfolio", name: "vendables" },
      "idx_vendables_tenant",
      [{ name: "tenant_id" }],
    );
    context.schema.addColumn(
      { schema: "portfolio", name: "proposals" },
      "tenant_id",
      "text",
      (col) => {
        col.nullable();
      },
    );
    context.data.update(
      { schema: "portfolio", name: "proposals" },
      { tenant_id: column("id") },
      [isNull("tenant_id")],
    );
    context.schema.alterColumnNullable(
      { schema: "portfolio", name: "proposals" },
      "tenant_id",
      false,
    );
    context.schema.createIndex(
      { schema: "portfolio", name: "proposals" },
      "idx_proposals_tenant",
      [{ name: "tenant_id" }],
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropIndex("idx_proposals_tenant", "portfolio");
    context.schema.dropColumn(
      { schema: "portfolio", name: "proposals" },
      "tenant_id",
      { ifExists: true },
    );
    context.schema.dropIndex("idx_vendables_tenant", "portfolio");
    context.schema.dropConstraint(
      { schema: "portfolio", name: "vendables" },
      "uniq_vendable_tenant_reference",
    );
    context.schema.createIndex(
      { schema: "portfolio", name: "vendables" },
      "uniq_vendable_reference",
      [{ name: "reference" }],
      { unique: true, ifNotExists: true },
    );
    context.schema.dropColumn(
      { schema: "portfolio", name: "vendables" },
      "tenant_id",
      { ifExists: true },
    );
  },
};
