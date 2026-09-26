/**
 * @mosaix/theme — PostgresThemeAssignmentsStore
 */

import type {
  ThemeAssignment,
  ThemeAssignmentsStore,
  ThemeTarget,
} from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";
import { ThemeAssignmentSchema } from "@mosaix/schemas";
import { ThemeValidationError } from "./theme-errors.js";
import type { ThemeMutationListener } from "./in-memory-theme-assignments-store.js";

export interface PostgresThemeAssignmentsStoreOptions {
  onMutation?: ThemeMutationListener;
  tableName?: string;
}

export class PostgresThemeAssignmentsStore implements ThemeAssignmentsStore {
  private readonly table: string;
  private cache = new Map<string, ThemeAssignment>();

  constructor(
    private readonly db: DatabasePort,
    private readonly options: PostgresThemeAssignmentsStoreOptions = {},
  ) {
    this.table = options.tableName ?? "theme_assignments";
  }

  private keyFor(target: ThemeTarget): string {
    return `${target.type}:${target.id}`;
  }

  private rowToAssignment(row: Record<string, unknown>): ThemeAssignment {
    return {
      target: {
        type: String(row["target_type"]),
        id: String(row["target_id"]),
      },
      themeId: String(row["theme_id"]),
      mode: (row["mode"] as any) ?? "system",
      ...(row["version"] ? { version: String(row["version"]) } : {}),
      source: String(row["source"] ?? "admin") as ThemeAssignment["source"],
      updatedAt: String(row["updated_at"]),
      ...(row["updated_by"] ? { updatedBy: String(row["updated_by"]) } : {}),
    };
  }

  async init(): Promise<void> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT target_type, target_id, theme_id, mode, version, source, updated_at, updated_by FROM "${this.table}"`,
    );
    for (const row of rows) {
      const assignment = this.rowToAssignment(row);
      this.cache.set(this.keyFor(assignment.target), assignment);
    }
  }

  assign(assignment: ThemeAssignment): void {
    const result = ThemeAssignmentSchema.safeParse(assignment);
    if (!result.success) {
      throw new ThemeValidationError(result.error.issues);
    }
    this.cache.set(this.keyFor(assignment.target), assignment);
    void this.db
      .execute(
        `INSERT INTO "${this.table}" (target_type, target_id, theme_id, mode, version, source, updated_at, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (target_type, target_id) DO UPDATE SET theme_id=$3, mode=$4, version=$5, source=$6, updated_at=$7, updated_by=$8`,
        [
          assignment.target.type,
          assignment.target.id,
          assignment.themeId,
          assignment.mode ?? "system",
          assignment.version ?? null,
          assignment.source ?? "admin",
          assignment.updatedAt ?? new Date().toISOString(),
          assignment.updatedBy ?? "system",
        ],
      )
      .catch(() => {});
    this.emit({
      target: assignment.target,
      assignment,
      changedBy: (assignment.updatedBy ?? "system").trim() || "system",
      at: assignment.updatedAt ?? new Date().toISOString(),
    });
  }

  unassign(target: ThemeTarget): void {
    const key = this.keyFor(target);
    const removed = this.cache.get(key);
    if (removed === undefined) return;
    this.cache.delete(key);
    void this.db
      .execute(`DELETE FROM "${this.table}" WHERE target_type=$1 AND target_id=$2`, [
        target.type,
        target.id,
      ])
      .catch(() => {});
    this.emit({
      target,
      assignment: removed,
      changedBy: (removed.updatedBy ?? "system").trim() || "system",
      at: removed.updatedAt ?? new Date().toISOString(),
    });
  }

  get(target: ThemeTarget): ThemeAssignment | undefined {
    const record = this.cache.get(this.keyFor(target));
    return record === undefined ? undefined : { ...record };
  }

  list(): ThemeAssignment[] {
    return Array.from(this.cache.values());
  }

  seed(assignments: readonly ThemeAssignment[]): void {
    for (const a of assignments) {
      const result = ThemeAssignmentSchema.safeParse(a);
      if (!result.success) throw new ThemeValidationError(result.error.issues);
    }
    for (const a of assignments) this.cache.set(this.keyFor(a.target), a);
  }

  private emit(mutation: Parameters<ThemeMutationListener>[0]): void {
    this.options.onMutation?.(mutation);
  }
}
