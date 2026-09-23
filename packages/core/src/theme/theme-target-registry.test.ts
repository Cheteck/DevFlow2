/**
 * ThemeTargetRegistry — co-located vitest suite (THEME-04).
 *
 * Mirrors the `capability-registry.test.ts` beforeEach-factory shape.
 *
 * Fixture rule (PRD-0008 §1, roadmap invariant #8 / THEME-15): fixture
 * target types are `store` / `brand` / `workspace` ONLY — no other target
 * type literal appears in this file (verified by grep).
 *
 * Note: `toEqualTypeOf` reports false for structurally identical types
 * declared in different modules; object shapes are locked with mutual
 * `toMatchTypeOf` (both directions), the repo convention from Phase 1.
 */

import { describe, expect, expectTypeOf, it, beforeEach } from "vitest";

import {
  ThemeTargetRegistry,
  type ThemeTargetCapabilities,
  type ThemeTargetRegistration,
} from "./theme-target-registry";

/** store / brand / workspace fixture set — never a space-type target (invariant #8). */
const shownTypes: readonly ThemeTargetRegistration[] = [
  {
    type: "store",
    capabilities: { userSelectable: true, adminConfigurable: true },
  },
  {
    type: "brand",
    capabilities: { userSelectable: true, adminConfigurable: false },
  },
  {
    type: "workspace",
    capabilities: { userSelectable: false, adminConfigurable: true },
  },
];

describe("ThemeTargetRegistry", () => {
  let registry: ThemeTargetRegistry;

  beforeEach(() => {
    registry = new ThemeTargetRegistry();
  });

  it("registers a type programmatically and get() returns its capabilities", () => {
    const registration: ThemeTargetRegistration = {
      type: "store",
      capabilities: { userSelectable: true, adminConfigurable: true },
    };
    registry.register(registration);

    expect(registry.get("store")).toEqual(registration);
    expect(registry.get("store")?.capabilities.userSelectable).toBe(true);
    expect(registry.get("store")?.capabilities.adminConfigurable).toBe(true);
  });

  it("accepts declarative initial registrations (manifest surface)", () => {
    const declared = new ThemeTargetRegistry(shownTypes);

    expect(declared.has("brand")).toBe(true);
    expect(declared.has("store")).toBe(true);
    expect(declared.get("workspace")?.capabilities.userSelectable).toBe(false);
    expect(declared.get("workspace")?.capabilities.adminConfigurable).toBe(
      true,
    );
  });

  it("last registration wins for a duplicated type (programmatic + initial)", () => {
    const declared = new ThemeTargetRegistry([
      {
        type: "store",
        capabilities: { userSelectable: true, adminConfigurable: true },
      },
    ]);

    // re-register the same type with different capabilities — no throw
    expect(() =>
      declared.register({
        type: "store",
        capabilities: { userSelectable: false, adminConfigurable: false },
      }),
    ).not.toThrow();

    const stored = declared.get("store");
    expect(stored?.capabilities.userSelectable).toBe(false);
    expect(stored?.capabilities.adminConfigurable).toBe(false);
    expect(declared.size).toBe(1);
  });

  it("returns undefined for unregistered target types (D-17)", () => {
    expect(registry.get("unknown")).toBeUndefined();
    expect(registry.has("unknown")).toBe(false);
  });

  it("list() returns all registrations (Map values) and returns a copy", () => {
    for (const registration of shownTypes) registry.register(registration);

    expect(registry.list()).toHaveLength(3);
    const snapshot = registry.list();
    snapshot.push({
      type: "community",
      capabilities: { userSelectable: true, adminConfigurable: true },
    });

    // mutating the returned array does not affect internal state
    expect(registry.list()).toHaveLength(3);
  });

  it("bootstrap-only semantics: registry has no resolution surface", () => {
    registry.register(shownTypes[0]);
    // compile-time/visibility check: no `resolve` property may exist
    expect("resolve" in registry).toBe(false);
  });

  it("locks the PRD §4.2b shapes (capabilities + registration)", () => {
    expectTypeOf<ThemeTargetCapabilities>().toMatchTypeOf<{
      readonly userSelectable: boolean;
      readonly adminConfigurable: boolean;
    }>();
    expectTypeOf<{
      readonly userSelectable: boolean;
      readonly adminConfigurable: boolean;
    }>().toMatchTypeOf<ThemeTargetCapabilities>();

    expectTypeOf<ThemeTargetRegistration>().toMatchTypeOf<{
      readonly type: string;
      readonly capabilities: ThemeTargetCapabilities;
    }>();
    expectTypeOf<{
      readonly type: string;
      readonly capabilities: ThemeTargetCapabilities;
    }>().toMatchTypeOf<ThemeTargetRegistration>();
  });
});
