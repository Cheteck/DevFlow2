import { describe, expect, it, vi, beforeEach } from "vitest";
import { Router } from "@mosaix/sdk";
import { registerAuthRoutes } from "../src/server/routes/auth-routes.js";

// ---------------------------------------------------------------------------
// Mock the shared auth composition so the register route can be tested
// in isolation without a real database.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockRegisterUser: vi.fn(),
}));

vi.mock("../bootstrap/auth-composition.js", () => ({
  getSharedAuthComposition: vi.fn(() => ({
    authManager: {
      registerUser: mocks.mockRegisterUser,
      authenticate: vi.fn(),
    },
    sessionManager: {
      get: vi.fn().mockResolvedValue(null),
      isExpired: vi.fn().mockReturnValue(false),
      isRevoked: vi.fn().mockReturnValue(false),
      revoke: vi.fn().mockResolvedValue(undefined),
    },
  })),
}));

interface TestRouteHandler {
  path: string;
  method: string;
  handler: (req: {
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }) => Promise<{
    statusCode: number;
    headers?: Record<string, string>;
    body: Record<string, unknown>;
  }>;
}

function findRoute(
  router: Router,
  path: string,
  method: string,
): TestRouteHandler | undefined {
  const routes = ((router as unknown) as { routes: TestRouteHandler[] })
    .routes || [];
  return routes.find((r) => r.path === path && r.method === method);
}

describe("Public registration (POST /api/auth/register)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockRegisterUser.mockResolvedValue("identity_123");
  });

  it("register route exists and is a POST handler", () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST");
    expect(route).toBeDefined();
  });

  it("rejects missing email or password with 400", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    const res = await route!.handler({ body: {} });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();

    const res2 = await route!.handler({ body: { email: "a@b.c" } });
    expect(res2.statusCode).toBe(400);

    const res3 = await route!.handler({ body: { password: "secret123" } });
    expect(res3.statusCode).toBe(400);
  });
  it("rejects invalid email format with 400", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    const res = await route!.handler({
      body: { email: "not-an-email", password: "secret123" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invalid email address");
  });

  it("rejects password shorter than 8 characters with 400", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    const res = await route!.handler({
      body: { email: "a@b.c", password: "short" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Password must be at least 8 characters");
  });

  it("rejects display name shorter than 2 characters with 400", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    const res = await route!.handler({
      body: { email: "a@b.c", password: "secret123", displayName: "X" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Display name must be at least 2 characters");
  });

  it("creates a user with valid input and returns 201", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    const res = await route!.handler({
      body: {
        email: "new.user@example.com",
        password: "secret123",
        displayName: "New User",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.identityId).toBe("identity_123");

    expect(mocks.mockRegisterUser).toHaveBeenCalledWith({
      provider: "credentials",
      tenantId: "default",
      email: "new.user@example.com",
      displayName: "New User",
      password: "secret123",
      attributes: {
        role: "member",
        registrationSource: "public",
        emailVerified: false,
      },
    });
  });

  it("normalizes email to lowercase before registration", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    await route!.handler({
      body: {
        email: "USER@Example.COM",
        password: "secret123",
        displayName: "User",
      },
    });

    expect(mocks.mockRegisterUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" }),
    );
  });

  it("never trusts a client-provided role — forces 'member'", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    await route!.handler({
      body: {
        email: "a@b.c",
        password: "secret123",
        displayName: "User",
        role: "admin",
      },
    });

    expect(mocks.mockRegisterUser).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({ role: "member" }),
      }),
    );
  });

  it("returns 409 when email is already in use", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    mocks.mockRegisterUser.mockRejectedValue(
      new Error("SQLITE_CONSTRAINT_UNIQUE: email"),
    );

    const res = await route!.handler({
      body: { email: "a@b.c", password: "secret123", displayName: "User" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("Email already in use");
  });

  it("does not store passwords in plain text", async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const route = findRoute(router, "/api/auth/register", "POST")!;

    mocks.mockRegisterUser.mockImplementation(async (input: any) => {
      expect(typeof input.password).toBe("string");
      expect(input.password.length).toBeGreaterThanOrEqual(8);
      return "identity_hashed";
    });

    const res = await route!.handler({
      body: { email: "a@b.c", password: "secret123", displayName: "User" },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain("secret123");
  });
});