import { computeChecksum, type Migration } from "@mosaix/migrations";

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
 */

const upStatements = [
  // Step 1: Add nullable column
  `ALTER TABLE "portfolio"."vendables" ADD COLUMN "tenant_id" text NULL;`,

  // Step 2: Backfill with 'legacy' placeholder
  `UPDATE "portfolio"."vendables" SET "tenant_id" = id WHERE "tenant_id" IS NULL;`,

  // Step 3: Enforce NOT NULL
  `ALTER TABLE "portfolio"."vendables" ALTER COLUMN "tenant_id" SET NOT NULL;`,

  // Step 4: Replace global UNIQUE(reference) with composite UNIQUE(tenant_id, reference).
  // The base migration created `uniq_vendable_reference` as a bare UNIQUE INDEX
  // (ORM `table.unique(...)`), NOT a named table constraint — so it must be
  // dropped with DROP INDEX, not DROP CONSTRAINT. Leaving it in place would keep
  // `reference` globally unique and silently defeat multi-tenant isolation.
  `DROP INDEX IF EXISTS "portfolio"."uniq_vendable_reference";`,
  `ALTER TABLE "portfolio"."vendables" ADD CONSTRAINT "uniq_vendable_tenant_reference" UNIQUE ("tenant_id", "reference");`,

  // Step 5: Add index for tenant filtering
  `CREATE INDEX "idx_vendables_tenant" ON "portfolio"."vendables"("tenant_id");`,

  // Repeat for proposals table
  `ALTER TABLE "portfolio"."proposals" ADD COLUMN "tenant_id" text NULL;`,
  `UPDATE "portfolio"."proposals" SET "tenant_id" = id WHERE "tenant_id" IS NULL;`,
  `ALTER TABLE "portfolio"."proposals" ALTER COLUMN "tenant_id" SET NOT NULL;`,
  `CREATE INDEX "idx_proposals_tenant" ON "portfolio"."proposals"("tenant_id");`,
]
  .join("\n");

const downStatements = [
  // Reverse proposals
  `DROP INDEX IF EXISTS "portfolio"."idx_proposals_tenant";`,
  `ALTER TABLE "portfolio"."proposals" DROP COLUMN IF EXISTS "tenant_id";`,

  // Reverse vendables
  `DROP INDEX IF EXISTS "portfolio"."idx_vendables_tenant";`,
  `ALTER TABLE "portfolio"."vendables" DROP CONSTRAINT IF EXISTS "uniq_vendable_tenant_reference";`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_vendable_reference" ON "portfolio"."vendables"("reference");`,
  `ALTER TABLE "portfolio"."vendables" DROP COLUMN IF EXISTS "tenant_id";`,
]
  .join("\n");

export const migration: Migration = {
  id: "portfolio.catalog.v1.008_tenant_id",
  content: upStatements,
  down: downStatements,
  checksum: computeChecksum(upStatements),
  resources: [
    // v1.008_tenant_id MODIFIE portfolio.vendables et portfolio.proposals
    // (ADD COLUMN tenant_id, ALTER COLUMN, ADD CONSTRAINT, CREATE INDEX),
    // elle n'en CREATE aucune. Seul v1.001_create_portfolio_tables CREATE
    // table:portfolio.vendables et v1.002_create_proposals CREATE
    // table:portfolio.proposals.
    // ressources vides = aucune table creee par cette migration.
  ],
};
