/**
 * @mosaix/core — InMemoryThemeAssignmentsStore (THEME-06, D-18)
 *
 * In-memory adapter for the `ThemeAssignmentsStore` port (contract in
 * `@mosaix/contracts` theme family). Owns binding persistence keyed by
 * `${target.type}:${target.id}` (same composite style as EventStore/EventBus).
 *
 * Behavior (D-18):
 *  - `assign` validates FIRST via `ThemeAssignmentSchema.safeParse` (strict,
 *    from @mosaix/schemas) → schema-invalid assignments throw
 *    `ThemeValidationError` (never a bare Zod TypeError, D-21); then writes
 *    (last-write-wins) and emits.
 *  - `unassign` removes when present and emits the removed record; an absent
 *    target is a silent, idempotent no-op (no throw, no emit).
 *  - `get`/`list` return undefined / a snapshot copy (CONVENTIONS lookups).
 *  - `seed` bulk-loads validated assignments WITHOUT emitting (WR-02).
 *
 * Mutation events: each assign/unassign synchronously calls the injected
 * `onMutation` listener with a `ThemeAssignmentChangedPayload`
 * (`{ target, assignment, changedBy, at }`); `changedBy` defaults to
 * `updatedBy ?? "system"` (trimmed, empty falls back to "system" — WR-03),
 * `at` to `updatedAt ?? now`. The store is wired to the kernel EventBus by
 * the service layer (02-04) — the store itself never imports event-bus
 * (port stays composable).
 *
 * Consumers: ThemeResolver (02-04), project bootstrap.
 */

import type {
  ThemeAssignment,
  ThemeAssignmentChangedPayload,
  ThemeAssignmentsStore,
  ThemeTarget,
} from "@mosaix/contracts";
import { ThemeAssignmentSchema } from "@mosaix/schemas";

import { ThemeValidationError } from "./theme-errors";

/** Synchronous listener receiving the mutation payload after each write. */
export interface ThemeMutationListener {
  (mutation: ThemeAssignmentChangedPayload): void;
}

export interface InMemoryThemeAssignmentsStoreOptions {
  /** Called synchronously after assign()/unassign() with the mutation payload. */
  onMutation?: ThemeMutationListener;
}

export class InMemoryThemeAssignmentsStore implements ThemeAssignmentsStore {
  private readonly assignments = new Map<string, ThemeAssignment>();

  constructor(
    private readonly options: InMemoryThemeAssignmentsStoreOptions = {},
  ) {}

  /** `${type}:${id}` composite key — same style as EventStore/EventBus. */
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
    if (removed === undefined) return; // idempotent no-op (D-18)
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

  /**
   * Bulk-loads assignments WITHOUT emitting mutation events (WR-02). Validates
   * every entry via ThemeAssignmentSchema — a schema-invalid entry throws
   * ThemeValidationError before anything is stored (all-or-nothing). Used by
   * createThemeResolver to re-seed a re-wrapped store so existing bindings
   * survive the wrap without backdated events.
   */
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

  /** Normalized changedBy: trimmed, never empty — falls back to "system" (WR-03). */
  private changedByOf(assignment: ThemeAssignment): string {
    return (assignment.updatedBy ?? "system").trim() || "system";
  }

  /** Synchronous emit-after-commit; listener exceptions propagate. */
  private emit(mutation: ThemeAssignmentChangedPayload): void {
    this.options.onMutation?.(mutation);
  }
}
