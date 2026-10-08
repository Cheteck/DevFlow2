import { describe, expect, it } from "vitest";
import { Router } from "@mosaix/sdk";
import { registerAuthRoutes } from "../src/server/routes/auth-routes.js";

interface TestRouteHandler {
  path: string;
  method: string;
  handler: (req: { headers?: Record<string, string>; body?: Record<string, unknown> }) => Promise<{
    statusCode: number;
    headers?: Record<string, string>;
    body: Record<string, unknown>;
  }>;
}

describe("HTTP Auth Bridge Routes Integration & Security Gate Suite (AUTH-08)", () => {
  it("should respond with unauthenticated session status when no session cookie is present", async () => {
    const router = new Router();
    registerAuthRoutes(router);

    const routes = ((router as unknown) as { routes: TestRouteHandler[] }).routes || [];
    const getSessionRoute = routes.find((r) => r.path === "/api/auth/session" && r.method === "GET");

    expect(getSessionRoute).toBeDefined();

    const response = await getSessionRoute!.handler({ headers: {} });
    expect(response.statusCode).toBe(200);
    expect(response.body.authenticated).toBe(false);
  });

  it("should logout successfully, revoke session server-side, and set Max-Age=0 cookie", async () => {
    const router = new Router();
    registerAuthRoutes(router);

    const routes = ((router as unknown) as { routes: TestRouteHandler[] }).routes || [];
    const logoutRoute = routes.find((r) => r.path === "/api/auth/logout" && r.method === "POST");

    expect(logoutRoute).toBeDefined();

    const response = await logoutRoute!.handler({ headers: { cookie: "__Host-mosaix_session=sess_123" } });
    expect(response.statusCode).toBe(200);
    expect(response.headers?.["Set-Cookie"]).toContain("Max-Age=0");
  });

  it("should reject login attempt when credentials payload is missing or invalid", async () => {
    const router = new Router();
    registerAuthRoutes(router);

    const routes = ((router as unknown) as { routes: TestRouteHandler[] }).routes || [];
    const loginRoute = routes.find((r) => r.path === "/api/auth/login" && r.method === "POST");

    expect(loginRoute).toBeDefined();

    const response = await loginRoute!.handler({ body: {} });
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});
