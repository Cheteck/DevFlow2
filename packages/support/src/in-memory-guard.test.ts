import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { InMemoryGuard } from "./in-memory-guard.js";

describe("InMemoryGuard", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL.NODE_ENV;
    process.env.MOSAIX_ENV = ORIGINAL.MOSAIX_ENV;
    process.env.MOSAIX_DEMO_USERS = ORIGINAL.MOSAIX_DEMO_USERS;
    if (ORIGINAL.MOSAIX_DEMO_USERS === undefined) {
      delete process.env.MOSAIX_DEMO_USERS;
    }
    vi.restoreAllMocks();
  });

  it("warns (no throw) in dev with demo on", () => {
    process.env.NODE_ENV = "development";
    delete process.env.MOSAIX_ENV;
    delete process.env.MOSAIX_DEMO_USERS;
    expect(() => InMemoryGuard.reportFallback("TestAdapter")).not.toThrow();
  });

  it("throws when demo is explicitly off, even outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.MOSAIX_ENV;
    process.env.MOSAIX_DEMO_USERS = "false";
    expect(() => InMemoryGuard.reportFallback("TestAdapter")).toThrow(
      /MOSAIX_DEMO_USERS=false/,
    );
  });

  it("throws in production by default", () => {
    process.env.NODE_ENV = "production";
    delete process.env.MOSAIX_ENV;
    delete process.env.MOSAIX_DEMO_USERS;
    expect(() => InMemoryGuard.reportFallback("TestAdapter")).toThrow(
      /ProductionInvariantViolation/,
    );
  });

  it("parses the demo flag like isDemoMode (explicit wins)", () => {
    expect(
      InMemoryGuard.isDemoExplicitlyDisabled({ MOSAIX_DEMO_USERS: "false" }),
    ).toBe(true);
    expect(
      InMemoryGuard.isDemoExplicitlyDisabled({ MOSAIX_DEMO_USERS: "0" }),
    ).toBe(true);
    expect(
      InMemoryGuard.isDemoExplicitlyDisabled({ MOSAIX_DEMO_USERS: "true" }),
    ).toBe(false);
    expect(InMemoryGuard.isDemoExplicitlyDisabled({})).toBe(false);
    expect(
      InMemoryGuard.isDemoExplicitlyDisabled({ NODE_ENV: "production" }),
    ).toBe(true);
  });
});
