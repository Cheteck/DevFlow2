/**
 * @mosaix/theme — InMemoryThemeAssignmentsStore
 */

import type {
  ThemeAssignment,
  ThemeAssignmentChangedPayload,
  ThemeAssignmentsStore,
  ThemeTarget,
} from "@mosaix/contracts";
import { ThemeAssignmentSchema } from "@mosaix/schemas";
import { ThemeValidationError } from "./theme-errors.js";

export interface ThemeMutationListener {
  (mutation: ThemeAssignmentChangedPayload): void;
}

export interface InMemoryThemeAssignmentsStoreOptions {
  onMutation?: ThemeMutationListener;
}

export class InMemoryThemeAssignmentsStore implements ThemeAssignmentsStore {
  private readonly assignments = new Map<string, ThemeAssignment>();

  constructor(
    private readonly options: InMemoryThemeAssignmentsStoreOptions = {}
  ) {}

  private keyFor(target: ThemeTarget): string {
    return `${target.type}:${target.id}`;
  }

  assign(assignment: ThemeAssignment): void {
    const result = ThemeAssignmentSchema.safeParse(assignment);
    if (!result.success) {
      throw new ThemeValidationError(result.error.issues);
    }
    this.assignments.set(this.keyFor(assignment.target), assignment);
    this.emit({
      target: assignment.target,
      assignment,
      changedBy: this.changedByOf(assignment),
      at: assignment.updatedAt ?? new Date().toISOString(),
    });
  }

  unassign(target: ThemeTarget): void {
    const key = this.keyFor(target);
    const removed = this.assignments.get(key);
    if (removed === undefined) return;
    this.assignments.delete(key);
    this.emit({
      target,
      assignment: removed,
      changedBy: this.changedByOf(removed),
      at: removed.updatedAt ?? new Date().toISOString(),
    });
  }

  get(target: ThemeTarget): ThemeAssignment | undefined {
    const record = this.assignments.get(this.keyFor(target));
    return record === undefined ? undefined : { ...record };
  }

  list(): ThemeAssignment[] {
    return Array.from(this.assignments.values());
  }

  seed(assignments: readonly ThemeAssignment[]): void {
    for (const assignment of assignments) {
      const result = ThemeAssignmentSchema.safeParse(assignment);
      if (!result.success) {
        throw new ThemeValidationError(result.error.issues);
      }
    }
    for (const assignment of assignments) {
      this.assignments.set(this.keyFor(assignment.target), assignment);
    }
  }

  private changedByOf(assignment: ThemeAssignment): string {
    return (assignment.updatedBy ?? "system").trim() || "system";
  }

  private emit(mutation: ThemeAssignmentChangedPayload): void {
    this.options.onMutation?.(mutation);
  }
}
