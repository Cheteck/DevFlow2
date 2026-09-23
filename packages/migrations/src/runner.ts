/**
 * MigrationRunner — executes an already-computed `MigrationPlan` against a
 * `DatabasePort` and records the applied state in a `MigrationStore`
 * (ADR-0006 §8, §9, §12).
 *
 * The Runner never computes an upgrade itself: it only executes the validated
 * plan. Concurrency is delegated to the adapter via
 * `DatabasePort.acquireMigrationLock()` (R3). Each operation runs inside a
 * transaction (per-migration atomicity, PRD §26) when the adapter supports
 * it, and every migration executed by one invocation belongs to the same
 * batch (PRD §30).
 */

import type { DatabasePort } from "@mosaix/ports-database";
import { MigrationExecutionError, MigrationLockError } from "./errors";
import type { MigrationPlan } from "./planner";
import { parseMigrationId } from "./migration";
import type { MigrationStore } from "./store";

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
   * operations (content) and `down` operations (rollback), recording each
   * applied migration in the Store with its checksum, owner and batch id.
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
          await this.applyUp(op.migration, batchId);
          applied.push(op.migration.id);
          logs.push(
            `Successfully applied "${op.migration.id}" in ${Date.now() - start}ms`,
          );
        } else {
          logs.push(`Rolling back migration: ${op.migration.id}`);
          await this.applyDown(op.migration);
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
   */
  async previewSQL(
    plan: MigrationPlan,
  ): Promise<readonly { id: string; sql: string }[]> {
    const previews: { id: string; sql: string }[] = [];
    for (const op of plan.operations) {
      if (op.operation === "up") {
        previews.push({ id: op.migration.id, sql: op.migration.content });
      } else {
        if (op.migration.down) {
          previews.push({ id: op.migration.id, sql: op.migration.down });
        }
      }
    }
    return previews;
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

  private async applyUp(
    migration: { id: string; content: string; checksum: string },
    batchId: string,
  ): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.execute(migration.content);
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

  private async applyDown(migration: {
    id: string;
    down?: string;
  }): Promise<void> {
    const down = migration.down;
    if (down === undefined) {
      throw new Error(
        `Migration "${migration.id}" has no down() body for rollback`,
      );
    }
    try {
      await this.db.transaction(async (tx) => {
        await tx.execute(down);
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
}
