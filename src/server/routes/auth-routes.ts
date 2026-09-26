/**
 * @server/routes — Authentication & Registration Wizard API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { registrationWizardService } from "../../../apps/citadelle/src/domain/registration-wizard.service.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";

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
