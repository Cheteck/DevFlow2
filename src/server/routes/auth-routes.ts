/**
 * src/server/routes/auth-routes.ts — Flagged HTTP Auth Bridge Endpoints (AUTH-06, AUTH-07).
 */

import { Router } from "@mosaix/sdk";
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

    try {
      const result = await authManager.authenticate({
        provider: "credentials",
        credentials: { email: body.email, password: body.password },
      });

      return {
        statusCode: 200,
        headers: {
          "Set-Cookie": `__Host-mosaix_session=${result.session.id}; Path=/; Secure; HttpOnly; SameSite=Lax`,
        },
        body: {
          success: true,
          sessionId: result.session.id,
          identityId: result.identity.id,
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
    if (!session) {
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
