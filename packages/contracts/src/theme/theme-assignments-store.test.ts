/**
 * ThemeAssignmentsStore port — contract-level type-lock suite (THEME-06,
 * D-18).
 *
 * Locks the D-18 port surface to exactly four methods — assign / unassign /
 * get / list — via expectTypeOf at the contract level (theme-family
 * convention, mirroring `theme-contracts.test.ts`). No filtering helpers,
 * no runtime code: the port is type-only.
 *
 * Fixture rule (roadmap invariant #8): store / brand / workspace targets
 * only.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { ThemeAssignmentsStore } from "../index";
import type { ThemeAssignment } from "./theme-assignment";
import type { ThemeTarget } from "./theme-target";

describe("ThemeAssignmentsStore (D-18 port surface)", () => {
  it("declares exactly the 4-method D-18 port", () => {
    type StoreShape = {
      assign(assignment: ThemeAssignment): void;
      unassign(target: ThemeTarget): void;
      get(target: ThemeTarget): ThemeAssignment | undefined;
      list(): ThemeAssignment[];
    };

    expectTypeOf<ThemeAssignmentsStore>().toMatchTypeOf<StoreShape>();
    expectTypeOf<StoreShape>().toMatchTypeOf<ThemeAssignmentsStore>();
  });

  it("is exported from the @mosaix/contracts barrel", () => {
    // compile-time proof: importable as a type from the package entry
    const _lock: { ThemeAssignmentsStore: ThemeAssignmentsStore } = {
      ThemeAssignmentsStore: {} as ThemeAssignmentsStore,
    };
    expectTypeOf(
      _lock.ThemeAssignmentsStore,
    ).toMatchTypeOf<ThemeAssignmentsStore>();
  });
});
