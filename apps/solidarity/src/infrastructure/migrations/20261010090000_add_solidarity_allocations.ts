import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * solidarity.relief.v1.003 — durable allocation ledger for confirmed
 * resource allocations (responsibilities.md §2.3, §2.4, §8).
 *
 * The UNIQUE key on "idempotencyKey" enforces idempotence at the database
 * level: a replayed confirmation resolves to the stored row instead of
 * reserving stock twice, even across process restarts.
 *
 * Postgres-only. Applies on the `solidarity.*` names (v1.002).
 */

const upStatements: string[] = [
  `CREATE TABLE IF NOT EXISTS "solidarity"."allocations" (
    "id" TEXT PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "needId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_allocations_idempotency" ON "solidarity"."allocations" ("idempotencyKey");`,
  `CREATE INDEX IF NOT EXISTS "idx_allocations_need" ON "solidarity"."allocations" ("needId");`,
];

const downStatements: string[] = [`DROP TABLE IF EXISTS "solidarity"."allocations";`];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20261010090000_add_solidarity_allocations",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: ["table:solidarity.allocations"],
};
