import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * portfolio.catalog.v1.007 — approval persistence for the vendor proposal saga.
 *
 * Restores the session work lost before a055b8e (V1.2): `approvedTerms` and
 * `auditTrail` (JSON), `approvedOfferId` and `idempotencyKey` on
 * `portfolio.proposals`. Idempotent (ADD COLUMN IF NOT EXISTS); the Postgres
 * repository hydrates missing columns with safe defaults, so the migration
 * can land before or after the code.
 */

const upStatements: string[] = [
  `ALTER TABLE IF EXISTS "portfolio"."proposals" ADD COLUMN IF NOT EXISTS "approvedTerms" JSONB;`,
  `ALTER TABLE IF EXISTS "portfolio"."proposals" ADD COLUMN IF NOT EXISTS "approvedOfferId" TEXT;`,
  `ALTER TABLE IF EXISTS "portfolio"."proposals" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;`,
  `ALTER TABLE IF EXISTS "portfolio"."proposals" ADD COLUMN IF NOT EXISTS "auditTrail" JSONB NOT NULL DEFAULT '[]';`,
];

const downStatements: string[] = [
  `ALTER TABLE IF EXISTS "portfolio"."proposals" DROP COLUMN IF EXISTS "auditTrail";`,
  `ALTER TABLE IF EXISTS "portfolio"."proposals" DROP COLUMN IF EXISTS "idempotencyKey";`,
  `ALTER TABLE IF EXISTS "portfolio"."proposals" DROP COLUMN IF EXISTS "approvedOfferId";`,
  `ALTER TABLE IF EXISTS "portfolio"."proposals" DROP COLUMN IF EXISTS "approvedTerms";`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20261013010000_proposal_approval_fields",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: ["table:portfolio.proposals"],
};
