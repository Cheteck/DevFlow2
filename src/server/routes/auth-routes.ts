/**
 * @server/routes — Authentication & Registration Wizard API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { registrationWizardService } from "../../../apps/citadelle/src/domain/registration-wizard.service.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";
import { isDemoMode } from "../../shell/profiles.js";

function validateCsrfOrigin(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return true;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;
    return originHost === host;
  } catch {
    return false;
  }
}

export async function handleAuthRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  // AUTH-06: Session Login Endpoint
  if (pathname === "/api/auth/login" && req.method === "POST") {
    try {
      if (!validateCsrfOrigin(req)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Validation CSRF échouée (Origin/Host non valide)." }));
        return true;
      }

      const data = await readLimitedJson<{ email?: string; password?: string }>(req);
      if (!data.email || !data.password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Email et mot de passe requis." }));
        return true;
      }

      // DEMO-OFF Gate: Production authentication requires Citadelle / SessionStore validation
      if (!isDemoMode()) {
        // TODO: Wire Citadelle SessionStore credentials verification in production mode
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Authentification de production requiert la validation Citadelle SessionStore." }));
        return true;
      }

      const sessionId = "sess-" + Date.now();
      const isSecure = Boolean(req.socket && "encrypted" in req.socket && req.socket.encrypted);
      const cookieName = isSecure ? "__Host-mosaix_session" : "mosaix_session";
      const cookieHeader = `${cookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` + (isSecure ? "; Secure" : "");

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": cookieHeader,
      });
      res.end(JSON.stringify({ success: true, sessionId, message: "Connexion démo réussie." }));
      return true;
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: String(err) }));
      return true;
    }
  }

  // AUTH-06: Session Logout Endpoint
  if (pathname === "/api/auth/logout" && (req.method === "POST" || req.method === "GET")) {
    const isSecure = Boolean(req.socket && "encrypted" in req.socket && req.socket.encrypted);
    const cookieName = isSecure ? "__Host-mosaix_session" : "mosaix_session";
    const cookieHeader = `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` + (isSecure ? "; Secure" : "");

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader,
    });
    res.end(JSON.stringify({ success: true, message: "Déconnexion effectuée." }));
    return true;
  }

  // AUTH-06: Session Check Endpoint
  if (pathname === "/api/auth/session" && req.method === "GET") {
    const cookie = req.headers.cookie || "";
    const hasSession = cookie.includes("mosaix_session=") || cookie.includes("__Host-mosaix_session=");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ authenticated: hasSession }));
    return true;
  }

  // Wizard: Start Registration
  if (pathname === "/api/auth/register/wizard/start" && req.method === "POST") {
    const draft = registrationWizardService.startRegistration();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, draft }));
    return true;
  }

  // Wizard: Get Draft Status
  const getDraftMatch = pathname.match(/^\/api\/auth\/register\/wizard\/([^/]+)$/);
  if (getDraftMatch && req.method === "GET") {
    const draftId = getDraftMatch[1];
    const draft = registrationWizardService.getDraft(draftId);
    if (!draft) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Session d'inscription introuvable ou expirée." }));
      return true;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, draft }));
    return true;
  }

  // Wizard: Submit Step
  const stepMatch = pathname.match(/^\/api\/auth\/register\/wizard\/([^/]+)\/step\/([123])$/);
  if (stepMatch && req.method === "POST") {
    const draftId = stepMatch[1];
    const stepNum = parseInt(stepMatch[2], 10);

    try {
      const data = await readLimitedJson<Record<string, unknown>>(req);

      let result;
      if (stepNum === 1) {
        result = registrationWizardService.saveStep1(
          draftId,
          data as unknown as Parameters<typeof registrationWizardService.saveStep1>[1],
        );
      } else if (stepNum === 2) {
        result = registrationWizardService.saveStep2(
          draftId,
          data as unknown as Parameters<typeof registrationWizardService.saveStep2>[1],
        );
      } else {
        result = registrationWizardService.saveStep3(
          draftId,
          data as unknown as Parameters<typeof registrationWizardService.saveStep3>[1],
        );
      }

      if (!result.valid) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, errors: result.errors }));
        return true;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, draft: result.draft }));
      return true;
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: String(err) }));
      return true;
    }
  }

  return false;
}
