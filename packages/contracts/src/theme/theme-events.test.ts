/**
 * Theme events — type-assertion suite for the theme event contracts (D-11).
 *
 * Locks the PRD §13 literal shapes: event `type` literals, string-typed
 * payload fields (never narrowed), and a constructed event value with a custom
 * target type (store/brand/workspace fixture rule — invariant #8 / THEME-15).
 *
 * PRD-0008 §13, CONTEXT D-11/D-12.
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  themeAssignmentChangedEvent,
  themeChangedEvent,
  type ThemeAssignmentChangedEvent,
  type ThemeChangedEvent,
} from "../index";

describe("ThemeAssignmentChangedEvent (D-11)", () => {
  it("type constant is theme.assignment.changed", () => {
    expect(themeAssignmentChangedEvent).toBe("theme.assignment.changed");
    expectTypeOf<
      ThemeAssignmentChangedEvent["type"]
    >().toEqualTypeOf<"theme.assignment.changed">();
  });

  it("payload carries target, assignment, changedBy and at", () => {
    const event: ThemeAssignmentChangedEvent = {
      type: themeAssignmentChangedEvent,
      payload: {
        target: { type: "brand", id: "brand_7" },
        assignment: {
          target: { type: "brand", id: "brand_7" },
          themeId: "ocean",
          source: "admin",
        },
        changedBy: "user_1",
        at: "2026-08-08T10:00:00.000Z",
      },
    };
    expect(event.payload.target.id).toBe("brand_7");
    expect(event.payload.assignment.themeId).toBe("ocean");
    expect(event.payload.changedBy).toBe("user_1");
  });
});

describe("ThemeChangedEvent (D-11, PRD §13)", () => {
  it("type constant is theme.changed", () => {
    expect(themeChangedEvent).toBe("theme.changed");
    expectTypeOf<ThemeChangedEvent["type"]>().toEqualTypeOf<"theme.changed">();
  });

  it("payload fields are strings per PRD §13 — mode is NOT narrowed to ThemeMode", () => {
    expectTypeOf<
      ThemeChangedEvent["payload"]["mode"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ThemeChangedEvent["payload"]["theme"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ThemeChangedEvent["payload"]["version"]
    >().toEqualTypeOf<string>();
  });

  it("builds a post-injection event value with an optional target", () => {
    const event: ThemeChangedEvent = {
      type: themeChangedEvent,
      payload: {
        theme: "ocean",
        mode: "dark",
        version: "1.2.3",
        appliedAt: "2026-08-08T10:00:01.000Z",
        target: { type: "store", id: "store_9" },
      },
    };
    expect(event.payload.theme).toBe("ocean");
    expect(event.payload.target?.type).toBe("store");
  });
});
