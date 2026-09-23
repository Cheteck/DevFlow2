/**
 * InMemoryThemeAssignmentsStore — co-located vitest suite (THEME-06, D-18).
 *
 * Gates store behavior: assign/get/list snapshot semantics, last-write-wins
 * replace, idempotent unassign, mutation emit on assign + unassign via the
 * injected onMutation listener, and ThemeValidationError (not a bare Zod
 * TypeError) on schema-invalid assignments.
 *
 * Fixture rule (roadmap invariant #8): store / brand / workspace targets
 * only — no other target-type literal appears in this file (grep gate).
 */

import { describe, expect, it, vi } from "vitest";

import type {
  ThemeAssignment,
  ThemeAssignmentChangedPayload,
  ThemeTarget,
} from "@mosaix/contracts";
import { ThemeAssignmentChangedPayloadSchema } from "@mosaix/schemas";
import { ThemeValidationError } from "./theme-errors";
import { InMemoryThemeAssignmentsStore } from "./in-memory-theme-assignments-store";

/** store target fixture — never a space-type target (invariant #8). */
const storeTarget: ThemeTarget = { type: "store", id: "store_1" };
const brandTarget: ThemeTarget = { type: "brand", id: "brand_1" };

function assignment(overrides: Partial<ThemeAssignment> = {}): ThemeAssignment {
  return {
    target: storeTarget,
    themeId: "ocean",
    source: "admin",
    updatedAt: "2026-08-09T01:00:00.000Z",
    updatedBy: "alice",
    ...overrides,
  };
}

describe("InMemoryThemeAssignmentsStore (THEME-06, D-18)", () => {
  it("assign() stores and get() returns the same assignment deep-equal", () => {
    const store = new InMemoryThemeAssignmentsStore();
    const input = assignment();

    store.assign(input);

    expect(store.get(storeTarget)).toEqual(input);
  });

  it("list() returns all stored assignments (snapshot copy)", () => {
    const store = new InMemoryThemeAssignmentsStore();
    store.assign(assignment());
    store.assign(assignment({ target: brandTarget, themeId: "forest" }));

    expect(store.list()).toHaveLength(2);
    const snapshot = store.list();
    snapshot.push(assignment({ themeId: "mutated" }));

    // mutating the returned array does not affect internal state
    expect(store.list()).toHaveLength(2);
  });

  it("assigning the same target twice replaces (last-write-wins), size stays 1", () => {
    const store = new InMemoryThemeAssignmentsStore();
    store.assign(assignment({ themeId: "ocean" }));
    store.assign(assignment({ themeId: "forest" }));

    expect(store.list()).toHaveLength(1);
    expect(store.get(storeTarget)?.themeId).toBe("forest");
  });

  it("unassign removes the assignment; unassign of an absent target is a no-op", () => {
    const store = new InMemoryThemeAssignmentsStore();
    store.assign(assignment());

    store.unassign(storeTarget);
    expect(store.get(storeTarget)).toBeUndefined();
    expect(store.list()).toHaveLength(0);

    // absent target: no throw, no mutation
    expect(() => store.unassign(storeTarget)).not.toThrow();
    expect(store.list()).toHaveLength(0);
  });

  it("onMutation fires with { target, assignment, changedBy, at } on assign", () => {
    const onMutation = vi.fn();
    const store = new InMemoryThemeAssignmentsStore({ onMutation });
    const input = assignment();

    store.assign(input);

    expect(onMutation).toHaveBeenCalledTimes(1);
    const payload: ThemeAssignmentChangedPayload = onMutation.mock.calls[0][0];
    expect(payload.target).toEqual(storeTarget);
    expect(payload.assignment).toEqual(input);
    expect(payload.changedBy).toBe("alice");
    expect(payload.at).toBe("2026-08-09T01:00:00.000Z");
  });

  it("onMutation fires on unassign carrying the removed record", () => {
    const onMutation = vi.fn();
    const store = new InMemoryThemeAssignmentsStore({ onMutation });
    store.assign(assignment());

    onMutation.mockClear();
    store.unassign(storeTarget);

    expect(onMutation).toHaveBeenCalledTimes(1);
    const payload: ThemeAssignmentChangedPayload = onMutation.mock.calls[0][0];
    expect(payload.target).toEqual(storeTarget);
    expect(payload.assignment.themeId).toBe("ocean");
    expect(payload.changedBy).toBe("alice");
    expect(payload.at).toBe("2026-08-09T01:00:00.000Z");
  });

  it("unassign of an absent target emits nothing (idempotent, D-18)", () => {
    const onMutation = vi.fn();
    const store = new InMemoryThemeAssignmentsStore({ onMutation });

    store.unassign(brandTarget);

    expect(onMutation).not.toHaveBeenCalled();
  });

  it("changedBy defaults to 'system' when the assignment has no updatedBy", () => {
    const onMutation = vi.fn();
    const store = new InMemoryThemeAssignmentsStore({ onMutation });

    store.assign(assignment({ updatedBy: undefined }));

    const payload: ThemeAssignmentChangedPayload = onMutation.mock.calls[0][0];
    expect(payload.changedBy).toBe("system");
  });

  it("WR-03: empty/whitespace updatedBy emits changedBy 'system' passing the payload schema", () => {
    const onMutation = vi.fn();
    const store = new InMemoryThemeAssignmentsStore({ onMutation });

    store.assign(assignment({ updatedBy: "" }));
    store.unassign(storeTarget);
    store.assign(assignment({ updatedBy: "   " }));

    expect(onMutation).toHaveBeenCalledTimes(3);
    for (const call of onMutation.mock.calls) {
      const payload: ThemeAssignmentChangedPayload = call[0];
      expect(payload.changedBy).toBe("system");
      expect(
        ThemeAssignmentChangedPayloadSchema.safeParse(payload).success,
      ).toBe(true);
    }
  });

  it("IN-02: get() returns a snapshot copy — mutating it never corrupts store state", () => {
    const store = new InMemoryThemeAssignmentsStore();
    store.assign(assignment());

    // two gets return distinct objects, not the internal record
    expect(store.get(storeTarget)).not.toBe(store.get(storeTarget));

    const snapshot = store.get(storeTarget);
    expect(snapshot).toBeDefined();
    if (snapshot !== undefined) {
      (snapshot as { themeId: string }).themeId = "mutated";
    }

    expect(store.get(storeTarget)?.themeId).toBe("ocean");
  });

  it("WR-02: seed() bulk-loads validated assignments without emitting", () => {
    const onMutation = vi.fn();
    const store = new InMemoryThemeAssignmentsStore({ onMutation });

    store.seed([
      assignment(),
      assignment({ target: brandTarget, themeId: "forest" }),
    ]);

    expect(onMutation).not.toHaveBeenCalled();
    expect(store.list()).toHaveLength(2);
    expect(store.get(storeTarget)?.themeId).toBe("ocean");
  });

  it("WR-02: seed() throws ThemeValidationError on a schema-invalid entry (all-or-nothing)", () => {
    const store = new InMemoryThemeAssignmentsStore();
    const invalid = assignment({
      source: undefined,
    }) as unknown as ThemeAssignment;

    expect(() => store.seed([assignment(), invalid])).toThrow(
      ThemeValidationError,
    );
    expect(store.list()).toHaveLength(0);
  });

  it("schema-invalid assignment throws ThemeValidationError and stores nothing", () => {
    const store = new InMemoryThemeAssignmentsStore();
    // missing `source` — schema breach
    const invalid = assignment({
      source: undefined,
    }) as unknown as ThemeAssignment;

    expect(() => store.assign(invalid)).toThrow(ThemeValidationError);
    try {
      store.assign(invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(ThemeValidationError);
      if (error instanceof ThemeValidationError) {
        expect(error.code).toBe("THEME_VALIDATION");
        expect(error.details.issues).toBeDefined();
      }
    }
    expect(store.list()).toHaveLength(0);
  });
});
