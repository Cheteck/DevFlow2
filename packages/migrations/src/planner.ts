/**
 * MigrationPlanner — computes the deterministic delta between the desired
 * state (Registry) and the current state (Store) and produces an immutable
 * `MigrationPlan` (ADR-0006 §8, §9, §10).
 *
 * The Planner only decides; the Runner only executes. Two invocations with the
 * same source state (Registry) and the same target state (Store) produce the
 * exact same plan (R14).
 */

import { computeChecksum } from "./checksum";
import {
  MigrationChecksumError,
  MigrationMissingError,
  MigrationResourceConflictError,
} from "./errors";
import type { Migration } from "./migration";
import type { MigrationRegistry } from "./registry";
import type { ExecutedMigration, MigrationStore } from "./store";

/** One step of an immutable migration plan. */
export interface PlannedMigration {
  readonly migration: Migration;
  readonly operation: "up" | "down";
}

/** Immutable, inspectable migration plan (ADR-0006 §9). */
export interface MigrationPlan {
  readonly id: string;
  readonly createdAt: Date;
  readonly sourceVersion: string;
  readonly operations: readonly PlannedMigration[];
}

/** Rollback target (PRD §29-31). `true` undoes the last batch. */
export type RollbackTarget =
  | { readonly kind: "last-batch" }
  | { readonly kind: "steps"; readonly count: number };

export interface PlanOptions {
  /** Build a rollback plan (down) instead of an upgrade plan (up). */
  readonly rollback?: boolean | RollbackTarget;
}

/** Derives a deterministic source version from the registry content. */
export function computeSourceVersion(registry: MigrationRegistry): string {
  const migrations = registry.all();
  const fingerprint = migrations.map((m) => `${m.id}:${m.checksum}`).join("\n");
  return computeChecksum(fingerprint);
}

export class MigrationPlanner {
  constructor(
    private readonly registry: MigrationRegistry,
    private readonly store: MigrationStore,
  ) {}

  /**
   * Computes the plan. Upgrade by default: new migrations are planned `up`,
   * applied migrations that changed are rejected (`MigrationChecksumError`),
   * store migrations absent from the registry are blocking
   * (`MigrationMissingError`, R5). Resource collisions among the planned
   * migrations are rejected at Blueprint level (R9).
   *
   * Rollback: planned `down` in reverse application order (PRD §29). Without
   * options this undoes the last batch; with `{ kind: "steps", count }` it
   * undoes the last `count` applied migrations.
   */
  async plan(options: PlanOptions = {}): Promise<MigrationPlan> {
    const desired = this.registry.all();
    const executed = await this.store.list();
    const executedById = new Map(executed.map((e) => [e.id, e]));

    this.assertStoreConsistent(desired, executedById);

    if (options.rollback !== undefined && options.rollback !== false) {
      return this.buildRollbackPlan(desired, executed, options.rollback);
    }

    const operations: PlannedMigration[] = [];
    for (const migration of desired) {
      if (!executedById.has(migration.id)) {
        operations.push({ migration, operation: "up" });
      }
    }

    this.assertNoResourceCollisions(operations);

    return this.buildPlan(operations);
  }

  private buildRollbackPlan(
    desired: readonly Migration[],
    executed: readonly ExecutedMigration[],
    target: boolean | RollbackTarget,
  ): MigrationPlan {
    const byId = new Map(desired.map((m) => [m.id, m]));
    const toRollback = this.selectRollbackSet(executed, target);

    const operations: PlannedMigration[] = [];
    for (const entry of toRollback) {
      const migration = byId.get(entry.id);
      if (migration === undefined) {
        throw new MigrationMissingError(entry.id);
      }
      if (migration.down === undefined) continue;
      operations.push({ migration, operation: "down" });
    }

    return this.buildPlan(operations);
  }

  /**
   * Selects the migrations to roll back, in reverse application order
   * (PRD §29). The store lists in application order (oldest first), so the
   * selection is reversed.
   */
  private selectRollbackSet(
    executed: readonly ExecutedMigration[],
    target: boolean | RollbackTarget,
  ): readonly ExecutedMigration[] {
    const applied = [...executed];

    let selected: ExecutedMigration[];
    if (typeof target === "boolean" || target.kind === "last-batch") {
      const lastBatch =
        applied.length > 0 ? applied[applied.length - 1]!.batchId : undefined;
      if (lastBatch === undefined) return [];
      selected = applied.filter((e) => e.batchId === lastBatch);
    } else {
      selected = applied.slice(-target.count);
    }

    return selected.reverse();
  }

  private assertStoreConsistent(
    desired: readonly Migration[],
    executedById: Map<string, { checksum: string }>,
  ): void {
    const desiredIds = new Set(desired.map((m) => m.id));
    for (const id of executedById.keys()) {
      if (!desiredIds.has(id)) {
        throw new MigrationMissingError(id);
      }
    }
    for (const migration of desired) {
      const executedMigration = executedById.get(migration.id);
      if (
        executedMigration !== undefined &&
        executedMigration.checksum !== migration.checksum
      ) {
        throw new MigrationChecksumError(
          migration.id,
          executedMigration.checksum,
          migration.checksum,
        );
      }
    }
  }

  private assertNoResourceCollisions(
    operations: readonly PlannedMigration[],
  ): void {
    const resourceOwners = new Map<string, string>();
    for (const op of operations) {
      for (const resource of op.migration.resources) {
        const existing = resourceOwners.get(resource);
        if (existing !== undefined && existing !== op.migration.id) {
          throw new MigrationResourceConflictError(resource, [
            existing,
            op.migration.id,
          ]);
        }
        resourceOwners.set(resource, op.migration.id);
      }
    }
  }

  private buildPlan(operations: readonly PlannedMigration[]): MigrationPlan {
    const sourceVersion = computeSourceVersion(this.registry);
    const fingerprint = [
      sourceVersion,
      ...operations.map(
        (op) => `${op.operation}:${op.migration.id}:${op.migration.checksum}`,
      ),
    ].join("\n");
    return {
      id: `plan:${computeChecksum(fingerprint)}`,
      createdAt: new Date(),
      sourceVersion,
      operations,
    };
  }
}
