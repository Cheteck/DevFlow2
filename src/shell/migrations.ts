/**
 * @shell — Migration execution + verification.
 *
 * - `runShellMigrations()` plans the aggregated shell registry
 *   (`createShellMigrationRegistry()`) against the persistent ledger and
 *   applies the delta. Used by the CLI (`mosaix migrate`) — never by the
 *   boot path.
 * - `getPendingMigrationIds()` is the boot verifier: pure read, creates
 *   nothing. A missing ledger means a fresh database → every desired
 *   migration is pending.
 */
import type { DatabasePort } from "@mosaix/ports-database";
import {
  MigrationPlanner,
  MigrationRunner,
  SqlMigrationStore,
  type RunResult,
} from "@mosaix/migrations";
import { createShellMigrationRegistry } from "./migration-registry.js";

/**
 * Apply pending shell migrations. Idempotent: a second call with no new
 * migrations applies nothing.
 */
export async function runShellMigrations(db: DatabasePort): Promise<RunResult> {
  const registry = createShellMigrationRegistry();
  const store = new SqlMigrationStore(db);
  const planner = new MigrationPlanner(registry, store);
  const plan = await planner.plan();
  const runner = new MigrationRunner(db, store);
  const result = await runner.run(plan);
  if (result.applied.length > 0) {
    console.log(
      `[migrations] applied: ${result.applied.join(", ")} (batch ${result.batchId})`,
    );
  }
  return result;
}

async function ledgerExists(db: DatabasePort): Promise<boolean> {
  try {
    if (db.capabilities.dialect === "postgres") {
      const rows = await db.query<{ cls: string | null }>(
        `SELECT to_regclass('public.mosaix_migrations') AS cls`,
      );
      return rows[0]?.cls !== null;
    }
    const rows = await db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mosaix_migrations'`,
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * IDs of desired migrations not yet recorded in the ledger. Read-only:
 * creates no table, applies nothing. Throws on planner errors (checksum
 * mismatch, resource collision) — those are real problems, not "pending".
 */
export async function getPendingMigrationIds(
  db: DatabasePort,
): Promise<string[]> {
  const registry = createShellMigrationRegistry();
  if (!(await ledgerExists(db))) {
    return registry.all().map((m) => m.id);
  }
  const store = new SqlMigrationStore(db);
  const planner = new MigrationPlanner(registry, store);
  const plan = await planner.plan();
  return plan.operations
    .filter((o) => o.operation === "up")
    .map((o) => o.migration.id);
}
