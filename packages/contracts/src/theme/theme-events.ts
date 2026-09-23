/**
 * Theme domain events — payload-contract events (ADR-0003 style, mirroring the
 * `apps/identity/src/events/identity-events.ts` pattern).
 *
 * PRD-0008 §13 + D-11. `theme.assignment.changed` is the configuration trace
 * (an assignment was created/updated); `theme.changed` fires AFTER injection
 * of a resolved theme. Payload field types follow PRD §13 literally — `theme`,
 * `mode`, `version` are strings (the resolver's emitter produces them).
 *
 * Registration into the kernel `EventSchemaRegistry` happens in later phases
 * when the resolver emits (D-12); the Zod payload schemas live in
 * `@mosaix/schemas` (downward schemas → contracts boundary).
 *
 * Dependency direction: contracts → types (downward only), sibling theme
 * contracts only — no cross-family imports.
 * Consumers: `themeEventPayloadSchemas` in @mosaix/schemas, Phase 3 resolver.
 */

import type { ThemeAssignment } from "./theme-assignment";
import type { ThemeTarget } from "./theme-target";

export const themeAssignmentChangedEvent = "theme.assignment.changed" as const;
export const themeChangedEvent = "theme.changed" as const;

export interface ThemeAssignmentChangedPayload {
  readonly target: ThemeTarget;
  readonly assignment: ThemeAssignment;
  readonly changedBy: string;
  readonly at: string;
}

export interface ThemeChangedPayload {
  readonly theme: string;
  readonly mode: string;
  readonly version: string;
  readonly appliedAt: string;
  readonly target?: ThemeTarget;
}

export interface ThemeAssignmentChangedEvent {
  readonly type: typeof themeAssignmentChangedEvent;
  readonly payload: ThemeAssignmentChangedPayload;
}

export interface ThemeChangedEvent {
  readonly type: typeof themeChangedEvent;
  readonly payload: ThemeChangedPayload;
}
