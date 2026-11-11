/**
 * MigrationPlanner — computes the deterministic delta between the desired
 * state (Registry) and the current state (Store) and produces an immutable
 * `MigrationPlan` (ADR-0006 §8, §9, §10).
 *
 * The Planner only decides; the Runner only executes. Two invocations with
 * the same source state (Registry) and the same target state (Store) produce
 * the exact same plan (R14).
 *
 * Compilation boundary (Phase 07): the Planner is the single place where a
 * migration is turned into executable SQL statements. The plan therefore
 * carries the compiled statements (`PlannedMigration.statements`) and the
 * Runner executes them verbatim — the previewed SQL is exactly the executed
 * SQL.
 */

import { computeChecksum } from "./checksum.js";
import { MigrationCompiler } from "./compiler.js";
import {
  MigrationChecksumError,
  MigrationExecutionError,
  MigrationMissingError,
  MigrationResourceConflictError,
} from "./errors.js";
import {
  PostgresGrammar,
  SQLiteGrammar,
  type SqlStatement,
} from "./grammar.js";
import type { Migration } from "./migration.js";
import type { MigrationRegistry } from "./registry.js";
import type { MigrationRuntime } from "./migration-context.js";
import type { ExecutedMigration, MigrationStore } from "./store.js";

/** One step of an immutable migration plan. */
export interface PlannedMigration {
  readonly migration: Migration;
  readonly operation: "up" | "down";
  /**
   * Compiled statements, ready to be executed by the Runner. The Planner
   * guarantees they match what the migration declares — the Runner never
   * re-compiles and never re-interprets the migration.
   */
  readonly statements: readonly SqlStatement[];
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

/**
 * Default runtime used when the caller does not provide one. SQLite is the
 * portable default of the engine; production callers (shell, CLI) always
 * pass the real capabilities of their adapter.
 */
export const DEFAULT_MIGRATION_RUNTIME: MigrationRuntime = {
  dialect: "sqlite",
  capabilities: {
    transactions: true,
    lock: { distributed: false, processSafe: true, runtimeSafe: true },
  },
};

/** Derives a deterministic source version from the registry content. */
export function computeSourceVersion(registry: MigrationRegistry): string {
  const migrations = registry.all();
  const fingerprint = migrations.map((m) => `${m.id}:${m.checksum}`).join("\n");
  return computeChecksum(fingerprint);
}

export class MigrationPlanner {
  private readonly compiler: MigrationCompiler;

  constructor(
    private readonly registry: MigrationRegistry,
    private readonly store: MigrationStore,
    runtime: MigrationRuntime = DEFAULT_MIGRATION_RUNTIME,
  ) {
    const grammar =
      runtime.dialect === "postgres"
        ? new PostgresGrammar()
        : new SQLiteGrammar();
    this.compiler = new MigrationCompiler(grammar, runtime.dialect, runtime);
  }

  /**
   * Computes the plan. Upgrade by default: new migrations are planned `up`,
   * applied migrations that changed are rejected (`MigrationChecksumError`),
   * store migrations absent from the registry are blocking
   * (`MigrationMissingError`, R5). Resource collisions among the planned
   * migrations are rejected at Blueprint level (R9).
   *
   * Rollback: planned `down` in reverse application order (PRD §29). A
   * TypeScript migration without `downMigration`
   * is irreversible: the rollback is refused before any mutation.
   */
  async plan(options: PlanOptions = {}): Promise<MigrationPlan> {
    const desired = this.registry.all();
    const executed = await this.store.list();
    const executedById = new Map(executed.map((e) => [e.id, e]));

    this.assertStoreConsistent(desired, executedById);

    if (options.rollback !== undefined && options.rollback !== false) {
      return this.buildRollbackPlan(desired, executed, options.rollback);
    }

    const pending = desired.filter(
      (migration) => !executedById.has(migration.id),
    );

    // Identity/resource assertions run BEFORE any compilation: a broken
    // desired state fails fast, without executing migration code.
    this.assertNoResourceCollisions(
      pending.map((migration) => ({ migration, operation: "up" as const })),
    );

    const operations: PlannedMigration[] = [];
    for (const migration of pending) {
      operations.push({
        migration,
        operation: "up",
        statements: await this.compileUp(migration),
      });
    }

    return this.buildPlan(operations);
  }

  /**
   * Compiles the upgrade direction of a migration.
   *
   * The MigrationCompiler turns the blueprints declared by `up(context)` into
   * SQL statements (SchemaBuilder DSL + data statements).
   */
  private async compileUp(
    migration: Migration,
  ): Promise<readonly SqlStatement[]> {
    const compiled = await this.compiler.compileUpAsync(migration);
    return compiled.statements;
  }

  /**
   * Compiles the rollback direction of a migration.
   *
   * A migration without `downMigration` is
   * irreversible: the rollback is refused before any mutation.
   *
   * @throws MigrationExecutionError when the migration is irreversible.
   */
  private async compileDown(
    migration: Migration,
  ): Promise<readonly SqlStatement[]> {
    const compiled = await this.compiler.compileDownAsync(migration);
    if (compiled !== undefined) {
      return compiled.statements;
    }
    throw new MigrationExecutionError(
      `Migration "${migration.id}" is irreversible: it declares no downMigration(). ` +
        `Rollback is refused before any mutation.`,
      migration.id,
    );
  }

  private async buildRollbackPlan(
    desired: readonly Migration[],
    executed: readonly ExecutedMigration[],
    target: boolean | RollbackTarget,
  ): Promise<MigrationPlan> {
    const byId = new Map(desired.map((m) => [m.id, m]));
    const toRollback = this.selectRollbackSet(executed, target);

    const operations: PlannedMigration[] = [];
    for (const entry of toRollback) {
      const migration = byId.get(entry.id);
      if (migration === undefined) {
        throw new MigrationMissingError(entry.id);
      }
      const statements = await this.compileDown(migration);
      operations.push({
        migration,
        operation: "down",
        statements,
      });
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

  /**
   * Rejects a desired state that does not match the ledger.
   *
   * Checksum comparison (R2): the executed checksum must be the declared
   * checksum, or one of the declared `legacyChecksums` — the explicit
   * compatibility mapping used when a migration is reworked (e.g. SQL string
   * → TypeScript native) without changing its historical identity.
   */
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
      if (executedMigration === undefined) {
        continue;
      }
      if (executedMigration.checksum === migration.checksum) {
        continue;
      }
      const legacy = migration.legacyChecksums ?? [];
      if (legacy.includes(executedMigration.checksum)) {
        continue;
      }
      throw new MigrationChecksumError(
        migration.id,
        executedMigration.checksum,
        migration.checksum,
      );
    }
  }

  private assertNoResourceCollisions(
    operations: readonly { readonly migration: Migration }[],
  ): void {
    const resourceOwners = new Map<string, string>(); // resource -> ownerId
    for (const op of operations) {
      const ownerId = this.registry.ownerOf(op.migration.id) ?? op.migration.id;
      for (const resource of op.migration.resources) {
        const existing = resourceOwners.get(resource);
        // Même owner : évolution autorisée (même ressource sur plusieurs
        // migrations d'un même owner). Collision uniquement entre owners différents.
        if (existing !== undefined && existing !== ownerId) {
          throw new MigrationResourceConflictError(resource, [
            existing,
            ownerId,
          ]);
        }
        resourceOwners.set(resource, ownerId);
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
