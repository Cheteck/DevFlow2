/**
 * @mosaix/auth — Zero-Trust Token Introspection & OIDC Bridge
 */

import crypto from "node:crypto";

export interface TokenIntrospectionResult {
  active: boolean;
  sub?: string;
  scope?: string;
  tenantId?: string;
  roles?: string[];
}

export interface OidcTokenBridgeOptions {
  secret?: string;
}

export class OidcTokenBridge {
  private readonly secret?: string;

  constructor(options: OidcTokenBridgeOptions = {}) {
    this.secret = options.secret ?? process.env["MOSAIX_AUTH_JWT_SECRET"];
  }

  async introspectToken(token: string): Promise<TokenIntrospectionResult> {
    if (!token || typeof token !== "string" || token.trim().length < 10) {
      return { active: false };
    }

    // Basic structure validation for JWT Bearer Tokens (three dot-separated segments)
    const parts = token.split(".");
    if (parts.length === 3) {
      const [headerB64, payloadB64, signatureB64] = parts;

      // Cryptographic signature check is strictly MANDATORY
      if (!this.secret) {
        return { active: false };
      }

      const expectedSig = crypto
        .createHmac("sha256", this.secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64url");
      if (signatureB64 !== expectedSig) {
        return { active: false };
      }

      try {
        const payloadStr = Buffer.from(payloadB64 as string, "base64url").toString("utf-8");
        const payload = JSON.parse(payloadStr);

        // Check expiration claim
        if (payload.exp && typeof payload.exp === "number" && Date.now() >= payload.exp * 1000) {
          return { active: false };
        }

        return {
          active: true,
          sub: payload.sub ?? "usr-zero-trust-1",
          scope: payload.scope ?? "openid profile email",
          tenantId: payload.tenantId ?? payload.tid ?? "tenant-default",
          roles: Array.isArray(payload.roles) ? payload.roles : ["user"],
        };
      } catch {
        return { active: false };
      }
    }

    return { active: false };
  }
}
