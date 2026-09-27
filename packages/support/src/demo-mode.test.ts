import { describe, it, expect } from "vitest";
import { isDemoMode } from "./demo-mode.js";

describe("isDemoMode (canonical)", () => {
  it("is enabled by default outside production", () => {
    expect(isDemoMode({})).toBe(true);
    expect(isDemoMode({ NODE_ENV: "development" })).toBe(true);
    expect(isDemoMode({ MOSAIX_ENV: "staging" })).toBe(true);
    expect(isDemoMode({ NODE_ENV: "production" })).toBe(false);
    expect(isDemoMode({ MOSAIX_ENV: "production" })).toBe(false);
  });

  it("explicit flag wins in any environment", () => {
    expect(
      isDemoMode({ NODE_ENV: "development", MOSAIX_DEMO_USERS: "false" }),
    ).toBe(false);
    expect(
      isDemoMode({ NODE_ENV: "development", MOSAIX_DEMO_USERS: "0" }),
    ).toBe(false);
    expect(
      isDemoMode({ NODE_ENV: "development", MOSAIX_DEMO_USERS: "1" }),
    ).toBe(true);
    expect(
      isDemoMode({ NODE_ENV: "production", MOSAIX_DEMO_USERS: "true" }),
    ).toBe(true);
  });
});
