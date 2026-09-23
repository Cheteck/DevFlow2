/**
 * Theme assignments store port — persistence boundary for theme bindings
 * (THEME-06, D-18).
 *
 * Lives in the `@mosaix/contracts` theme family (D-18 + CONTEXT discretion):
 * the port is a TYPE-ONLY contract, importable by `@mosaix/core` without Zod.
 * The Phase-2 in-memory delivery (`InMemoryThemeAssignmentsStore` in core)
 * implements this interface; a persisted/backend adapter is out of scope
 * (invariant #4).
 *
 * Target key convention: `${type}:${id}`. Lookups return `undefined` for
 * missing targets (CONVENTIONS.md), never throw. Mutation events
 * (`theme.assignment.changed`) are the store's concern via the injected
 * listener — the port itself declares no publish surface.
 *
 * Dependency direction: contracts → types (downward only), sibling theme
 * imports only — no cross-family imports (theme-events.ts rule).
 * Consumers: @mosaix/core store adapters, ThemeResolver (02-04).
 */

import type { ThemeAssignment } from "./theme-assignment";
import type { ThemeTarget } from "./theme-target";

export interface ThemeAssignmentsStore {
  /** Persists an assignment (create or replace by target key). */
  assign(assignment: ThemeAssignment): void;
  /** Removes the assignment for the target; idempotent no-op if absent. */
  unassign(target: ThemeTarget): void;
  /** Returns the assignment for the target, or undefined when absent. */
  get(target: ThemeTarget): ThemeAssignment | undefined;
  /** All assignments as a snapshot copy. */
  list(): ThemeAssignment[];
}
