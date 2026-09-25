import { describe, it, expect, beforeEach } from "vitest";
import type * as http from "node:http";
import type { URL } from "node:url";
import { isDemoMode, getActiveUserProfile, USER_PROFILES } from "./profiles";

describe("demo mode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MOSAIX_DEMO_USERS;
    delete process.env.MOSAIX_ENV;
    delete process.env.NODE_ENV;
  });

  it("is enabled by default outside production", () => {
    expect(isDemoMode({})).toBe(true);
    expect(isDemoMode({ NODE_ENV: "development" })).toBe(true);
    expect(isDemoMode({ MOSAIX_ENV: "staging" })).toBe(true);
  });

  it("is disabled in production unless forced", () => {
    expect(isDemoMode({ NODE_ENV: "production" })).toBe(false);
    expect(isDemoMode({ MOSAIX_ENV: "production" })).toBe(false);
    expect(
      isDemoMode({ NODE_ENV: "production", MOSAIX_DEMO_USERS: "true" }),
    ).toBe(true);
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
  });

  it("ignores ?role= query override when demo is off", () => {
    process.env.NODE_ENV = "production";
    const req = { headers: { cookie: "" } } as unknown as http.IncomingMessage;
    const url = new URL("http://localhost/?role=admin");
    expect(getActiveUserProfile(req, url)).toBe(USER_PROFILES.member);

    process.env.MOSAIX_DEMO_USERS = "true";
    expect(getActiveUserProfile(req, url)).toBe(USER_PROFILES.admin);
  });

  it("still honors the role cookie when demo is off", () => {
    const req = {
      headers: { cookie: "mosaix_role=moderator" },
    } as unknown as http.IncomingMessage;
    const url = new URL("http://localhost/");
    expect(getActiveUserProfile(req, url)).toBe(USER_PROFILES.moderator);
  });
});
