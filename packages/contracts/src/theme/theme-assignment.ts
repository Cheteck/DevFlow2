/**
 * Theme assignment — a binding of a theme to a target by an authority.
 *
 * PRD-0008 §4.2. `AssignmentSource` is intentionally distinct from
 * `ThemeResolutionSource`: the former records WHO assigned, the latter WHY a
 * resolution was chosen (D-04/D-05).
 *
 * Dependency direction: contracts → types (downward only).
 * Consumers: ThemeAssignmentChangedEvent payload, ThemeAssignmentSchema.
 */

import type { ThemeMode } from "./theme-mode";
import type { ThemeTarget } from "./theme-target";

export type AssignmentSource = "platform" | "admin" | "user" | "application";

export interface ThemeAssignment {
  readonly target: ThemeTarget;
  readonly themeId: string;
  /** Semver range, e.g. "^1.0.0". */
  readonly version?: string;
  readonly mode?: ThemeMode;
  readonly source: AssignmentSource;
  readonly updatedAt?: string;
  readonly updatedBy?: string;
}
