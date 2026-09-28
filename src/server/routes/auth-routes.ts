/**
 * @server/routes — Platform Authentication & Identity API Routes
 * Implements endpoints for login, registration, logout, session status, and user profile.
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import type { PlatformAuthComposition } from "../../../bootstrap/auth-composition.js";

function parseJsonBody(req: http.IncomingMessage, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    let receivedBytes = 0;
    let exceeded = false;

    req.on("data", (chunk: Buffer | string) => {
      if (exceeded) return;
      receivedBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      if (receivedBytes > maxBytes) {
        exceeded = true;
        req.pause();
        resolve({});
        return;
      }
      data += chunk;
    });

    req.on("end", () => {
      if (exceeded) return;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });

    req.on("error", () => {
      resolve({});
    });
  });
}

function extractSessionId(req: http.IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:__Host-mosaix_session|mosaix_session)=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function handleAuthRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  authComposition: PlatformAuthComposition,
): Promise<boolean> {
  const pathname = parsedUrl.pathname;
  const isProduction = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";

  // POST /api/auth/login
  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    const provider = String(body.provider || "local");

    if (!email || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Identifiant et mot de passe requis." }));
      return true;
    }

    const authResult = await authComposition.authManager.authenticate({
      provider,
      credentials: { email, password },
      tenantId: "default",
    });

    if (authResult.status !== "authenticated" || !authResult.session) {
      const errorMessage =
        authResult.status === "failed"
          ? authResult.error.message
          : "Échec d'authentification. Identifiants incorrects.";
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
      );
      return true;
    }

    const identity = await authComposition.identityStore.findById(authResult.principal.identityId);

    // Set secure session cookie
    const cookieName = isProduction ? "__Host-mosaix_session" : "mosaix_session";
    const secureFlag = isProduction ? "; Secure" : "";
    const cookieHeader = `${cookieName}=${authResult.session.id}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=2592000`;

    res.setHeader("Set-Cookie", cookieHeader);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        session: {
          id: authResult.session.id,
          expiresAt: authResult.session.expiresAt,
        },
        user: {
          id: authResult.principal.identityId,
          displayName: identity?.displayName || identity?.email?.split("@")[0] || email,
          email: identity?.email || email,
        },
      }),
    );
    return true;
  }

  // POST /api/auth/register
  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = await parseJsonBody(req);
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    const displayName = String(body.displayName || email.split("@")[0] || "Nouvel Utilisateur").trim();

    if (!email || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Email et mot de passe requis pour l'inscription." }));
      return true;
    }

    const existingIdentity = await authComposition.identityStore.findByEmail(email.toLowerCase());
    if (existingIdentity) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Un compte avec cet e-mail existe déjà." }));
      return true;
    }

    const identityId = await authComposition.authManager.registerUser({
      provider: "local",
      tenantId: "default",
      email,
      displayName,
      password,
    });

    if (!identityId) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Erreur lors de la création du compte." }));
      return true;
    }

    // Auto-login registered user
    const authResult = await authComposition.authManager.authenticate({
      provider: "local",
      credentials: { email, password },
      tenantId: "default",
    });

    if (authResult.status === "authenticated" && authResult.session) {
      const cookieName = isProduction ? "__Host-mosaix_session" : "mosaix_session";
      const secureFlag = isProduction ? "; Secure" : "";
      const cookieHeader = `${cookieName}=${authResult.session.id}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=2592000`;
      res.setHeader("Set-Cookie", cookieHeader);
    }

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        identityId,
        message: "Compte créé avec succès.",
      }),
    );
    return true;
  }

  // POST /api/auth/logout
  if (pathname === "/api/auth/logout" && (req.method === "POST" || req.method === "GET")) {
    const sessionId = extractSessionId(req);
    if (sessionId) {
      await authComposition.authManager.revokeSession(sessionId);
    }

    const cookieName = isProduction ? "__Host-mosaix_session" : "mosaix_session";
    const secureFlag = isProduction ? "; Secure" : "";
    const cookieHeader = `${cookieName}=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`;

    res.setHeader("Set-Cookie", cookieHeader);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Déconnexion réussie." }));
    return true;
  }

  // GET /api/auth/session
  if (pathname === "/api/auth/session" && req.method === "GET") {
    const sessionId = extractSessionId(req);
    const sessionCtx = sessionId ? await authComposition.sessionResolver.resolve(sessionId) : null;

    if (!sessionCtx) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ authenticated: false }));
      return true;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        authenticated: true,
        session: sessionCtx,
      }),
    );
    return true;
  }

  // GET /api/auth/profile
  if (pathname === "/api/auth/profile" && req.method === "GET") {
    const sessionId = extractSessionId(req);
    const sessionCtx = sessionId ? await authComposition.sessionResolver.resolve(sessionId) : null;

    if (!sessionCtx) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Non authentifié." }));
      return true;
    }

    const identity = await authComposition.identityStore.findById(sessionCtx.userId);
    if (!identity) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Identité non trouvée." }));
      return true;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        profile: {
          id: identity.id,
          email: identity.email,
          displayName: identity.displayName,
          tenantId: identity.tenantId,
          status: identity.status,
          createdAt: identity.createdAt,
        },
      }),
    );
    return true;
  }

  return false;
}
