import { describe, expect, it, afterEach } from "vitest";
import * as crypto from "node:crypto";
import { Router } from "@mosaix/http";
import { Gateway, validateJwt, isPublicRoute } from "./gateway";

function createMockJwt(secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ sub: "usr_test", tenantId: "tenant-test", roles: ["admin"], permissions: ["test:read"], exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

describe("Gateway HTTP Server", () => {
  it("initializes and handles router integration", async () => {
    const router = new Router();
    router.get("/health", () => ({ statusCode: 200, body: { status: "ok" } }));

    const gateway = new Gateway({ port: 0, router });
    expect(gateway).toBeDefined();
  });
});

describe("validateJwt", () => {
  const secret = "test-secret";

  it("returns null for non-Bearer tokens", () => {
    expect(validateJwt("invalid", secret)).toBeNull();
  });

  it("returns null for malformed tokens", () => {
    expect(validateJwt("Bearer abc.def", secret)).toBeNull();
  });

  it("returns null for tampered signatures", () => {
    const token = createMockJwt(secret) + "tamper";
    expect(validateJwt(`Bearer ${token}`, secret)).toBeNull();
  });

  it("returns payload for valid tokens", () => {
    const token = createMockJwt(secret);
    const payload = validateJwt(`Bearer ${token}`, secret);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("usr_test");
    expect(payload!.permissions).toContain("test:read");
  });
});

describe("isPublicRoute", () => {
  it("returns false for empty public routes config", () => {
    expect(isPublicRoute("/anything", undefined)).toBe(false);
    expect(isPublicRoute("/anything", [])).toBe(false);
  });

  it("returns true for exact matches", () => {
    expect(isPublicRoute("/health", ["/health", "/metrics"])).toBe(true);
  });

  it("returns false for non-matching routes", () => {
    expect(isPublicRoute("/protected", ["/health", "/metrics"])).toBe(false);
  });

  it("supports wildcard patterns", () => {
    expect(isPublicRoute("/tenants/acme/identity/login", ["/tenants/*/identity/login"])).toBe(true);
  });
});

describe("Gateway JWT Authentication Middleware", () => {
  const secret = "test-secret-key";
  let gateway: Gateway;

  afterEach(async () => {
    if (gateway) {
      await gateway.stop();
    }
  });

  it("rejects protected routes without token", async () => {
    const router = new Router();
    router.get("/protected", () => ({ statusCode: 200, body: { ok: true } }));

    gateway = new Gateway({
      port: 0,
      router,
      authOptions: { jwtSecret: secret, publicRoutes: ["/health"] },
    });
    await gateway.start();

    const addr = gateway.getAddress()!;
    const res = await fetch(`http://localhost:${addr.port}/protected`);
    expect(res.status).toBe(401);
  });

  it("allows access to public routes without token", async () => {
    const router = new Router();
    router.get("/public", () => ({ statusCode: 200, body: { ok: true } }));

    gateway = new Gateway({
      port: 0,
      router,
      authOptions: { jwtSecret: secret, publicRoutes: ["/public"] },
    });
    await gateway.start();

    const addr = gateway.getAddress()!;
    const res = await fetch(`http://localhost:${addr.port}/public`);
    expect(res.status).toBe(200);
  });

  it("allows access with valid JWT", async () => {
    const router = new Router();
    router.get("/protected", () => ({ statusCode: 200, body: { ok: true } }));

    gateway = new Gateway({
      port: 0,
      router,
      authOptions: { jwtSecret: secret, publicRoutes: [] },
    });
    await gateway.start();

    const addr = gateway.getAddress()!;
    const token = createMockJwt(secret);
    const res = await fetch(`http://localhost:${addr.port}/protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});

describe("AuthRateLimiterMiddleware Brute-Force Protection", () => {
  let gateway: Gateway;

  afterEach(async () => {
    if (gateway) {
      await gateway.stop();
    }
  });

  it("limits excessive login attempts on auth endpoints", async () => {
    const router = new Router();
    router.post("/api/auth/login", () => ({ statusCode: 200, body: { success: true } }));

    gateway = new Gateway({
      port: 0,
      router,
      authRateLimiterOptions: {
        authEndpoints: ["/api/auth/login"],
        maxAttempts: 3,
        refillRatePerSecond: 0.1,
      },
    });
    await gateway.start();

    const addr = gateway.getAddress()!;

    // First 3 attempts should pass
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`http://localhost:${addr.port}/api/auth/login`, { method: "POST" });
      expect(res.status).toBe(200);
    }

    // 4th attempt should be blocked with 429 Too Many Requests
    const res4 = await fetch(`http://localhost:${addr.port}/api/auth/login`, { method: "POST" });
    expect(res4.status).toBe(429);
    const body = await res4.json();
    expect(body.error).toBe("Too Many Requests");
  });
});

