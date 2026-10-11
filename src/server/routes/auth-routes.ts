/**
 * src/server/routes/auth-routes.ts — Flagged HTTP Auth Bridge Endpoints (AUTH-06, AUTH-07).
 */

import { Router } from "@mosaix/sdk";
import type * as http from "node:http";
import type { URL } from "node:url";
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

  router.post("/api/auth/register", async () => {
    // Explicit transitional contract: no fake signup while real
    // registration (IdentityRegistrationPort, AUTH-05) is not implemented.
    // The machine-readable 501 matches the `/register` waiting page.
    return {
      statusCode: 501,
      body: {
        error: "registration_not_enabled",
        message: "Public registration is not open yet.",
      },
    };
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
    json(res, 501, {
      error: "registration_not_enabled",
      message: "Public registration is not open yet.",
    });
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
