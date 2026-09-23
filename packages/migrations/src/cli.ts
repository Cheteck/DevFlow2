import type { MigrationRegistry } from "./registry";
import { MigrationPlanner } from "./planner";
import { MigrationRunner } from "./runner";
import type { MigrationStore } from "./store";
import type { DatabasePort } from "@mosaix/ports-database";

export interface MigrationStatus {
  readonly id: string;
  readonly applied: boolean;
  readonly appliedAt?: Date;
  readonly batchId?: string;
  readonly owner?: string;
}

export class MigrationCLI {
  private readonly planner: MigrationPlanner;
  private readonly runner: MigrationRunner;

  constructor(
    private readonly registry: MigrationRegistry,
    private readonly store: MigrationStore,
    db: DatabasePort,
  ) {
    this.planner = new MigrationPlanner(registry, store);
    this.runner = new MigrationRunner(db, store);
  }

  /** Run pending migrations (migrate). */
  async migrate(): Promise<{ applied: readonly string[]; batchId: string }> {
    const plan = await this.planner.plan();
    const res = await this.runner.run(plan);
    return { applied: res.applied, batchId: res.batchId };
  }

  /** Rollback migrations (migrate:rollback). */
  async rollback(steps?: number): Promise<{ rolledBack: readonly string[] }> {
    const target =
      steps !== undefined
        ? { kind: "steps" as const, count: steps }
        : { kind: "last-batch" as const };
    const plan = await this.planner.plan({ rollback: target });
    const res = await this.runner.run(plan);
    return { rolledBack: res.rolledBack };
  }

  /** Status of all migrations (migrate:status). */
  async status(): Promise<readonly MigrationStatus[]> {
    const desired = this.registry.all();
    const executed = await this.store.list();
    const executedMap = new Map(executed.map((e) => [e.id, e]));

    return desired.map((m) => {
      const exec = executedMap.get(m.id);
      return {
        id: m.id,
        applied: exec !== undefined,
        ...(exec !== undefined
          ? {
              appliedAt: exec.appliedAt,
              batchId: exec.batchId,
              owner: exec.owner,
            }
          : {}),
      };
    });
  }

  /** Generates a template for creating a migration (migrate:create). */
  static create(
    owner: string,
    module: string,
    version: string,
    sequence: number,
    name: string,
  ): { id: string; content: string } {
    const id = `${owner}.${module}.${version}.${sequence}_${name}`;
    const content = `-- Migration: ${id}\n-- Write your SQL schema here\n`;
    return { id, content };
  }
}
