/**
 * @mosaix/auth — Generic HMAC-SHA256 JWT service.
 *
 * Single canonical implementation for issuing and verifying platform JWTs.
 * Dogfeeding apps (identity, shell, gateway) MUST use this instead of
 * reimplementing `crypto.createHmac` locally.
 */

import * as crypto from "node:crypto";

export interface PlatformJwtPayload {
  sub: string;
  tenantId: string;
  email?: string;
  displayName?: string;
  roles?: string[];
  permissions?: string[];
  capabilities?: string[];
  exp?: number;
}

export interface JwtServiceOptions {
  secret: string;
  defaultTtlSeconds?: number;
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

export class JwtService {
  private readonly secret: string;
  private readonly defaultTtlSeconds: number;

  constructor(options: JwtServiceOptions) {
    if (!options.secret) {
      throw new Error("JwtService requires a secret. Provide MOSAIX_AUTH_JWT_SECRET.");
    }
    if (options.secret.length < 16) {
      console.warn("[Security] JwtService secret is shorter than 16 characters — use a longer secret in production.");
    }
    this.secret = options.secret;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 3600;
  }

  sign(payload: Omit<PlatformJwtPayload, "exp"> & { exp?: number }): string {
    const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const fullPayload: PlatformJwtPayload = {
      ...payload,
      exp: payload.exp ?? Math.floor(Date.now() / 1000) + this.defaultTtlSeconds,
    };
    const payloadB64 = base64urlEncode(JSON.stringify(fullPayload));
    const signature = crypto
      .createHmac("sha256", this.secret)
      .update(`${header}.${payloadB64}`)
      .digest("base64url");
    return `${header}.${payloadB64}.${signature}`;
  }

  verify(token: string): PlatformJwtPayload | null {
    if (!token || !token.startsWith("Bearer ")) return null;
    const raw = token.slice(7).trim();
    if (!raw) return null;
    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    try {
      const expected = crypto
        .createHmac("sha256", this.secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64url");
      const sigBuf = Buffer.from(signatureB64, "base64url");
      const expBuf = Buffer.from(expected, "base64url");
      if (sigBuf.length !== expBuf.length) return null;
      if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

      const payload = JSON.parse(base64urlDecode(payloadB64)) as PlatformJwtPayload;
      if (!payload.sub || !payload.tenantId) return null;
      if (payload.exp && Date.now() / 1000 > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  /** Verify a raw (non-Bearer) token — used by gateway pipeline internals. */
  verifyRaw(rawToken: string): PlatformJwtPayload | null {
    return this.verify(`Bearer ${rawToken}`);
  }
}

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.MOSAIX_AUTH_JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error("MOSAIX_AUTH_JWT_SECRET must be set with at least 16 characters in production");
  }
  console.warn("[Security] MOSAIX_AUTH_JWT_SECRET not set — using insecure development default. Set MOSAIX_AUTH_JWT_SECRET for production.");
  return "mosaix-jwt-secret-key-for-development-only";
}
