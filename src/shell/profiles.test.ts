import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type * as http from "node:http";
import { URL } from "node:url";
import { isDemoMode, getActiveUserProfile, getActiveSpaceProfile, USER_PROFILES, GUEST_USER_PROFILE } from "./profiles.js";
import { renderUserSwitcherWidget } from "./renderer.js";
import { InMemoryGuard } from "@mosaix/support";

describe("demo mode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MOSAIX_DEMO_USERS;
    delete process.env.MOSAIX_ENV;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
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

  it("returns guest profile when demo is off and no session exists", async () => {
    process.env.MOSAIX_DEMO_USERS = "false";
    const req = { headers: { cookie: "" } } as unknown as http.IncomingMessage;
    const url = new URL("http://localhost/?role=admin");
    const user = await getActiveUserProfile(req, url);

    expect(user).toBe(GUEST_USER_PROFILE);
    expect(user.id).toBe("guest");

    const widgetHtml = renderUserSwitcherWidget(user);
    expect(widgetHtml).toContain("Connexion");
    expect(widgetHtml).toContain("Inscription");
  });

  it("ignores role cookie and space profile when MOSAIX_DEMO_USERS=false", async () => {
    process.env.MOSAIX_DEMO_USERS = "false";
    const req = {
      headers: { cookie: "mosaix_role=moderator; mosaix_active_space=space-bijoux-amel" },
    } as unknown as http.IncomingMessage;
    const url = new URL("http://localhost/");

    expect(await getActiveUserProfile(req, url)).toBe(GUEST_USER_PROFILE);
    expect(getActiveSpaceProfile(req, url)).toBeNull();
  });

  it("throws error in InMemoryGuard when MOSAIX_DEMO_USERS=false", () => {
    process.env.MOSAIX_DEMO_USERS = "false";
    expect(() => InMemoryGuard.reportFallback("TestAdapter")).toThrow(
      "[InMemoryForbidden] In-memory storage/adapter \"TestAdapter\" and mock data are strictly forbidden when MOSAIX_DEMO_USERS=false"
    );
  });
});
