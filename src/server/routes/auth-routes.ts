/**
 * @server/routes — Authentication & Registration Wizard API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { registrationWizardService } from "../../../apps/citadelle/src/domain/registration-wizard.service.js";

export async function handleAuthRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

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

    let bodyStr = "";
    for await (const chunk of req) {
      bodyStr += chunk;
    }
    const data = JSON.parse(bodyStr || "{}");

    let result;
    if (stepNum === 1) {
      result = registrationWizardService.saveStep1(draftId, data);
    } else if (stepNum === 2) {
      result = registrationWizardService.saveStep2(draftId, data);
    } else {
      result = registrationWizardService.saveStep3(draftId, data);
    }

    if (!result.valid) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, errors: result.errors }));
      return true;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, draft: result.draft }));
    return true;
  }

  return false;
}
