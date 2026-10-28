/**
 * src/server/routes/auth-routes.ts — Flagged HTTP Auth Bridge Endpoints (AUTH-06, AUTH-07).
 */

import { Router } from "@mosaix/sdk";
import type * as http from "node:http";
import type { URL } from "node:url";
import { strictRateLimiter } from "../../shell/rate-limiter.js";
import { getSharedAuthComposition } from "../../../bootstrap/auth-composition.js";

export function registerAuthRoutes(router: Router): void {
  const { authManager, sessionManager } = getSharedAuthComposition();

  router.post("/api/auth/login", async (req) => {
    const body = req.body as { email?: string; password?: string } | undefined;
    if (!body?.email || !body?.password) {
      return {
        statusCode: 400,
        body: { error: "Missing email or password" },
      };
    }
    // No providers/stores in the shared Shell composition (Citadelle owns
    // login): honest 503 instead of a fabricated 401.
    if (!authManager) {
      return {
        statusCode: 503,
        body: { error: "Login is not configured on this node." },
      };
    }

    try {
      const result = await authManager.authenticate({
        provider: "credentials",
        credentials: { email: body.email, password: body.password },
        tenantId: "default",
      });
      if (result.status !== "authenticated") {
        return {
          statusCode: 401,
          body: { error: "Invalid credentials" },
        };
      }

      return {
        statusCode: 200,
        headers: {
          "Set-Cookie": `__Host-mosaix_session=${result.session.id}; Path=/; Secure; HttpOnly; SameSite=Lax`,
        },
        body: {
          success: true,
          sessionId: result.session.id,
          identityId: result.principal.identityId,
        },
      };
    } catch (_err) {
      return {
        statusCode: 401,
        body: { error: "Invalid credentials" },
      };
    }
  });

    router.post("/api/auth/logout", async (req) => {

    const cookieHeader = req.headers?.cookie || "";
    const match = cookieHeader.match(/__Host-mosaix_session=([^;]+)/);
    const sessionId = match?.[1];

    if (sessionId) {
      await sessionManager.revoke(sessionId);
    }

    return {
      statusCode: 200,
      headers: {
        "Set-Cookie": `__Host-mosaix_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,
      },
      body: { success: true, message: "Logged out successfully" },
    };
  });

  router.post("/api/auth/register", async (req) => {
    const body = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
      role?: unknown;
    } | undefined;

    // --- Validation des données d'entrée ---
    if (!body?.email || !body?.password) {
      return {
        statusCode: 400,
        body: { error: "Missing email or password" },
      };
    }

    if (!authManager) {
      return {
        statusCode: 503,
        body: { error: "Registration is not configured on this node." },
      };
    }

    const email = String(body.email).toLowerCase().trim();
    const displayName = String(body.displayName || email).trim();
    const password = String(body.password);

    // Format email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        statusCode: 400,
        body: { error: "Invalid email address" },
      };
    }

    // Password strength (align with RegistrationWizardService step 1)
    if (password.length < 8) {
      return {
        statusCode: 400,
        body: { error: "Password must be at least 8 characters" },
      };
    }

    // Display name minimum length
    if (displayName.length < 2) {
      return {
        statusCode: 400,
        body: { error: "Display name must be at least 2 characters" },
      };
    }

    // --- Sécurité : rôle forcé par défaut, jamais lu du formulaire ---
    // Public registration always gets the standard non-privileged role.
    // Any `role` provided by the client is ignored.
    const attributes: Record<string, unknown> = {
      role: "member",
      registrationSource: "public",
      emailVerified: false,
    };

    try {
      const identityId = await authManager.registerUser({
        provider: "credentials",
        tenantId: "default",
        email,
        displayName,
        password,
        attributes,
      });

      return {
        statusCode: 201,
        body: {
          success: true,
          identityId,
          message: "Account created successfully",
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      // Unique constraint violation on email (concurrent registration)
      if (
        /UNIQUE|unique|already exists|duplicate/i.test(message)
      ) {
        return {
          statusCode: 409,
          body: { error: "Email already in use" },
        };
      }
      // Never expose internal details to the client
      return {
        statusCode: 400,
        body: { error: "Registration failed" },
      };
    }
  });

  router.get("/api/auth/session", async (req) => {
    const cookieHeader = req.headers?.cookie || "";
    const match = cookieHeader.match(/__Host-mosaix_session=([^;]+)/);
    const sessionId = match?.[1];

    if (!sessionId) {
      return {
        statusCode: 200,
        body: { authenticated: false, session: null },
      };
    }

    const session = await sessionManager.get(sessionId);
    if (
      !session ||
      sessionManager.isExpired(session) ||
      sessionManager.isRevoked(session)
    ) {
      return {
        statusCode: 200,
        body: { authenticated: false, session: null },
      };
    }

    return {
      statusCode: 200,
      body: {
        authenticated: true,
        session: {
          id: session.id,
          identityId: session.identityId,
          expiresAt: session.expiresAt,
        },
      },
    };
  });
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += String(chunk);
    });
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function readSessionId(req: http.IncomingMessage): string | undefined {
  const cookieHeader = req.headers?.cookie || "";
  const match = cookieHeader.match(/__Host-mosaix_session=([^;]+)/);
  return match?.[1];
}

function json(res: http.ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(statusCode, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

/**
 * Legacy dispatcher-style adapter (`ApiRouteHandler` contract in
 * `api-dispatcher.ts`). Same three endpoints as `registerAuthRoutes`,
 * implemented on raw `IncomingMessage/ServerResponse`.
 */
export async function handleAuthRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
): Promise<boolean> {
  const pathname = parsedUrl.pathname;
  if (
    pathname !== "/api/auth/login" &&
    pathname !== "/api/auth/logout" &&
    pathname !== "/api/auth/register" &&
    pathname !== "/api/auth/session"
  ) {
    return false;
  }

  const { authManager, sessionManager } = getSharedAuthComposition();

  if (pathname === "/api/auth/login") {
    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed" });
      return true;
    }
    const body = await readJsonBody(req);
    if (typeof body["email"] !== "string" || typeof body["password"] !== "string") {
      json(res, 400, { error: "Missing email or password" });
      return true;
    }
    if (!authManager) {
      json(res, 503, { error: "Login is not configured on this node." });
      return true;
    }
    try {
      const result = await authManager.authenticate({
        provider: "credentials",
        credentials: { email: body["email"], password: body["password"] },
        tenantId: "default",
      });
      if (result.status !== "authenticated") {
        json(res, 401, { error: "Invalid credentials" });
        return true;
      }
      json(
        res,
        200,
        { success: true, sessionId: result.session.id, identityId: result.principal.identityId },
        {
          "Set-Cookie": `__Host-mosaix_session=${result.session.id}; Path=/; Secure; HttpOnly; SameSite=Lax`,
        },
      );
    } catch (_err) {
      json(res, 401, { error: "Invalid credentials" });
    }
    return true;
  }

  if (pathname === "/api/auth/logout") {
    const sessionId = readSessionId(req);
    if (sessionId) {
      await sessionManager.revoke(sessionId);
    }
    json(
      res,
      200,
      { success: true, message: "Logged out successfully" },
      {
        "Set-Cookie": `__Host-mosaix_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,
      },
    );
    return true;
  }

  const sessionId = readSessionId(req);
  if (pathname === "/api/auth/register") {
    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed" });
      return true;
    }
    // Rate limit: strict bucket for registration (anti-spam)
    if (!strictRateLimiter.middleware("auth:register")(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    const email =
      typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName =
      typeof body.displayName === "string"
        ? body.displayName.trim()
        : email || "";

    if (!email || !password) {
      json(res, 400, { error: "Missing email or password" });
      return true;
    }

    if (!authManager) {
      json(res, 503, { error: "Registration is not configured on this node." });
      return true;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      json(res, 400, { error: "Invalid email address" });
      return true;
    }

    if (password.length < 8) {
      json(res, 400, { error: "Password must be at least 8 characters" });
      return true;
    }

    if (displayName.length < 2) {
      json(res, 400, { error: "Display name must be at least 2 characters" });
      return true;
    }

    // Rôle forcé par défaut — jamais lu du formulaire client
    const attributes: Record<string, unknown> = {
      role: "member",
      registrationSource: "public",
      emailVerified: false,
    };

    try {
      const identityId = await authManager.registerUser({
        provider: "credentials",
        tenantId: "default",
        email,
        displayName,
        password,
        attributes,
      });
      json(res, 201, { success: true, identityId, message: "Account created successfully" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      if (/UNIQUE|unique|already exists|duplicate/i.test(message)) {
        json(res, 409, { error: "Email already in use" });
      } else {
        json(res, 400, { error: "Registration failed" });
      }
    }
    return true;
  }
  if (!sessionId) {
    json(res, 200, { authenticated: false, session: null });
    return true;
  }
  const session = await sessionManager.get(sessionId);
  if (
    !session ||
    sessionManager.isExpired(session) ||
    sessionManager.isRevoked(session)
  ) {
    json(res, 200, { authenticated: false, session: null });
    return true;
  }
  json(res, 200, {
    authenticated: true,
    session: { id: session.id, identityId: session.identityId, expiresAt: session.expiresAt },
  });
  return true;
}
