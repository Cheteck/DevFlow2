/**
 * MigrationRunner — executes an already-computed `MigrationPlan` against a
 * `DatabasePort` and records the applied state in a `MigrationStore`
 * (ADR-0006 §8, §9, §12).
 *
 * The Runner never computes an upgrade itself: it only executes the
 * validated plan. Concurrency is delegated to the adapter via
 * `DatabasePort.acquireMigrationLock()` (R3). Each operation runs inside a
 * transaction (per-migration atomicity, PRD §26) when the adapter supports
 * it, and every migration executed by one invocation belongs to the same
 * batch (PRD §30).
 *
 * The statements executed are the ones carried by the plan (compiled by the
 * Planner): the Runner never re-compiles and never re-interprets a
 * migration. Preview and execution therefore share the exact same SQL.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import { MigrationExecutionError, MigrationLockError } from "./errors.js";
import type { MigrationPlan, PlannedMigration } from "./planner.js";
import { parseMigrationId } from "./migration.js";
import type { MigrationStore } from "./store.js";

export interface RunResult {
  readonly applied: readonly string[];
  readonly rolledBack: readonly string[];
  readonly batchId: string;
  readonly logs?: readonly string[];
}

export interface RunOptions {
  readonly dryRun?: boolean;
  readonly dialect?: "sqlite" | "postgres";
}

/** Generates a unique batch id for a Runner invocation (PRD §30). */
export function newBatchId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class MigrationRunner {
  constructor(
    private readonly db: DatabasePort,
    private readonly store: MigrationStore,
  ) {}

  /**
   * Executes the plan under the adapter-provided migration lock. Applies `up`
   * operations and `down` operations (rollback), recording each applied
   * migration in the Store with its checksum, owner and batch id.
   *
   * If `dryRun: true` (Phase 7), SQL statements are pre-visualised and logged
   * without acquiring any lock or modifying any database state.
   */
  async run(plan: MigrationPlan, options: RunOptions = {}): Promise<RunResult> {
    const logs: string[] = [];
    const batchId = newBatchId();

    if (options.dryRun) {
      logs.push(`Starting dry-run for plan: ${plan.id}`);
      const previews = await this.previewSQL(plan);
      for (const p of previews) {
        logs.push(`[Dry-Run] Migration "${p.id}" would execute:\n${p.sql}`);
      }
      logs.push(`Dry-run completed successfully.`);
      return {
        applied: plan.operations
          .filter((o) => o.operation === "up")
          .map((o) => o.migration.id),
        rolledBack: plan.operations
          .filter((o) => o.operation === "down")
          .map((o) => o.migration.id),
        batchId,
        logs,
      };
    }

    logs.push(`Starting migration execution for plan: ${plan.id}`);
    const lock = await this.acquireLock();
    const applied: string[] = [];
    const rolledBack: string[] = [];
    try {
      for (const op of plan.operations) {
        const start = Date.now();
        if (op.operation === "up") {
          logs.push(`Applying migration: ${op.migration.id}`);
          await this.applyUp(op, batchId);
          applied.push(op.migration.id);
          logs.push(
            `Successfully applied "${op.migration.id}" in ${Date.now() - start}ms`,
          );
        } else {
          logs.push(`Rolling back migration: ${op.migration.id}`);
          await this.applyDown(op);
          rolledBack.push(op.migration.id);
          logs.push(
            `Successfully rolled back "${op.migration.id}" in ${Date.now() - start}ms`,
          );
        }
      }
    } finally {
      await lock.release();
    }
    logs.push(
      `Execution completed. Applied: ${applied.length}, Rolled back: ${rolledBack.length}`,
    );
    return { applied, rolledBack, batchId, logs };
  }

  /**
   * Compiles the plan operations to pre-installation SQL statements (previsualisation SQL, Phase 7).
   *
   * The preview is built from the compiled statements of the plan: the
   * previewed SQL is exactly the SQL that would be executed.
   */
  async previewSQL(
    plan: MigrationPlan,
  ): Promise<readonly { id: string; sql: string }[]> {
    return plan.operations.map((op) => ({
      id: op.migration.id,
      sql: op.statements.map((s) => s.sql).join("\n"),
    }));
  }

  private async acquireLock() {
    try {
      return await this.db.acquireMigrationLock();
    } catch (cause) {
      throw new MigrationLockError(
        "Unable to acquire the migration lock",
        cause,
      );
    }
  }

  /**
   * Executes the compiled statements of an upgrade operation, then records
   * the migration in the Store — both inside the same transaction (PRD §26).
   */
  private async applyUp(
    operation: PlannedMigration,
    batchId: string,
  ): Promise<void> {
    const migration = operation.migration;
    try {
      await this.db.transaction(async (tx) => {
        await this.executeStatements(tx, operation);
        await this.store.save({
          id: migration.id,
          owner: parseMigrationId(migration.id).owner,
          checksum: migration.checksum,
          batchId,
          appliedAt: new Date(),
        });
      });
    } catch (cause) {
      throw new MigrationExecutionError(
        `Migration "${migration.id}" failed to apply`,
        migration.id,
        cause,
      );
    }
  }

  /**
   * Executes the compiled statements of a rollback operation, then removes
   * the migration from the Store — both inside the same transaction.
   */
  private async applyDown(operation: PlannedMigration): Promise<void> {
    const migration = operation.migration;
    try {
      await this.db.transaction(async (tx) => {
        await this.executeStatements(tx, operation);
        await this.store.remove(migration.id);
      });
    } catch (cause) {
      throw new MigrationExecutionError(
        `Migration "${migration.id}" failed to roll back`,
        migration.id,
        cause,
      );
    }
  }

  /**
   * Executes the compiled statements in order.
   *
   * Parameters are only forwarded when the statement actually has some:
   * adapters use the simple-query protocol for parameterless statements,
   * which is what allows a statement to carry several SQL commands.
   */
  private async executeStatements(
    tx: { execute(sql: string, params?: readonly unknown[]): Promise<number> },
    operation: PlannedMigration,
  ): Promise<void> {
    for (const statement of operation.statements) {
      const params = statement.params.length > 0 ? statement.params : undefined;
      await tx.execute(statement.sql, params);
    }
  }
}
