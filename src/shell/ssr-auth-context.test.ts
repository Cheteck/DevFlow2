/**
 * SSR auth context tests (AUTH-07 steps 1-2).
 *
 * Anonymous is explicit: no cookie / invalid / expired / revoked session →
 * auth buttons, never the user menu. Demo personas only resolve when demo
 * mode is explicitly on.
 */

import { describe, it, expect } from "vitest";
import type * as http from "node:http";
import { URL } from "node:url";
import {
  buildSsrAuthContext,
  readOpaqueSessionId,
} from "./ssr-auth-context";
import { renderAuthButtons } from "./renderer";

function reqWithCookie(cookie: string): http.IncomingMessage {
  return { headers: { cookie } } as http.IncomingMessage;
}

const url = new URL("http://localhost/");

const liveSession = {
  sessionId: "sess_live",
  identityId: "user-1",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

describe("readOpaqueSessionId", () => {
  it("reads the __Host- session cookie and ignores role cookies", () => {
    expect(
      readOpaqueSessionId(
        reqWithCookie("__Host-mosaix_session=sess_abc; mosaix_role=admin"),
      ),
    ).toBe("sess_abc");
    expect(readOpaqueSessionId(reqWithCookie("mosaix_role=admin"))).toBeNull();
    expect(readOpaqueSessionId(reqWithCookie(""))).toBeNull();
  });
});

describe("buildSsrAuthContext", () => {
  it("is anonymous without any cookie when demo mode is off", async () => {
    const ctx = await buildSsrAuthContext(reqWithCookie(""), url, {
      resolveSession: async () => liveSession,
      demoMode: () => false,
    });
    expect(ctx.kind).toBe("anonymous");
  });

  it("is anonymous when the session cannot be resolved (forged/unknown)", async () => {
    const ctx = await buildSsrAuthContext(
      reqWithCookie("__Host-mosaix_session=sess_forged"),
      url,
      {
        resolveSession: async () => null,
        demoMode: () => false,
      },
    );
    expect(ctx.kind).toBe("anonymous");
  });

  it("fails closed to anonymous when the store throws", async () => {
    const ctx = await buildSsrAuthContext(
      reqWithCookie("__Host-mosaix_session=sess_live"),
      url,
      {
        resolveSession: async () => {
          throw new Error("store down");
        },
        demoMode: () => false,
      },
    );
    // buildSsrAuthContext itself never throws for store failures…
    expect(ctx.kind).toBe("anonymous");
  });

  it("is authenticated with a neutral profile for a valid session", async () => {
    const ctx = await buildSsrAuthContext(
      reqWithCookie("__Host-mosaix_session=sess_live"),
      url,
      {
        resolveSession: async () => liveSession,
        demoMode: () => false,
      },
    );
    expect(ctx.kind).toBe("authenticated");
    if (ctx.kind === "authenticated") {
      expect(ctx.session.sessionId).toBe("sess_live");
      expect(ctx.profile.id).toBe("user-1");
      expect(ctx.profile.name).not.toMatch(/Alex|Sarah|Imperia/);
    }
  });

    it("ignores ?role= when demo mode is off", async () => {

    const adminUrl = new URL("http://localhost/?role=admin");
    const ctx = await buildSsrAuthContext(reqWithCookie(""), adminUrl, {
      resolveSession: async () => null,
      demoMode: () => false,
    });
    expect(ctx.kind).toBe("anonymous");
  });

  it("resolves demo personas only when demo mode is on", async () => {
    const adminUrl = new URL("http://localhost/?role=admin");
    const ctx = await buildSsrAuthContext(reqWithCookie(""), adminUrl, {
      resolveSession: async () => null,
      demoMode: () => true,
    });
    expect(ctx.kind).toBe("demo");
  });
});

describe("renderAuthButtons", () => {
  it("links login/register with ?next= and contains no user menu", () => {
    const html = renderAuthButtons("/solara");
    expect(html).toContain('id="auth-buttons"');
    expect(html).toContain("/login?next=");
    expect(html).toContain("/register?next=");
    expect(html).toContain("Se connecter");
    expect(html).toContain("Créer un compte");
    expect(html).not.toContain("user-menu-dropdown");
    expect(html).not.toContain("Utilisateur local");
  });
});
