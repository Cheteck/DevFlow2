import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { OidcTokenBridge } from "./oidc-bridge";

describe("Auth Pipeline Integration Suite", () => {
  it("rejects any token if no secret is configured on the bridge", async () => {
    const bridge = new OidcTokenBridge({ secret: undefined });
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "usr-1" })).toString("base64url");
    const result = await bridge.introspectToken(`${header}.${payload}.sig`);
    expect(result.active).toBe(false);
  });

  it("verifies cryptographically signed JWT tokens", async () => {
    const secret = "test-super-secret-key-1234567890";
    const bridge = new OidcTokenBridge({ secret });

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-real-999",
        roles: ["admin"],
        tenantId: "tenant-acme",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");

    const validSig = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    const validJwt = `${header}.${payload}.${validSig}`;
    const result = await bridge.introspectToken(validJwt);

    expect(result.active).toBe(true);
    expect(result.sub).toBe("user-real-999");
    expect(result.roles).toEqual(["admin"]);
    expect(result.tenantId).toBe("tenant-acme");

    // Forged signature check
    const forgedJwt = `${header}.${payload}.forged_signature_xyz`;
    const forgedResult = await bridge.introspectToken(forgedJwt);
    expect(forgedResult.active).toBe(false);
  });
});
