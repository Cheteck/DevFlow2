/**
 * @server/routes — GDPR Compliance, Payment Webhooks, Event Streams, and Diagnostics
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { pspWebhookHandler } from "../../shell/psp-webhook-handler.js";
import type { AnonymizationOrchestrator } from "../../shell/anonymization-orchestrator.js";
import type { DistributedEventBackplane } from "../../shell/event-backplane.js";
import type { UserProfile } from "../../shell/profiles.js";
import { feedStore } from "../../shell/feed-store.js";
import { apps } from "../../shell/discovery.js";
import { bacRegistry } from "../../generated-bac-registry.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";

export async function handleComplianceAndSystemRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUser: UserProfile,
  anonymizationOrchestrator: AnonymizationOrchestrator,
  eventBackplane: DistributedEventBackplane
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  // 1. PSP Payment Gateway Webhook (P0 Gateway & Security)
  if (pathname === "/api/psp/webhook" && req.method === "POST") {
    await pspWebhookHandler.handleWebhookRequest(req, res);
    return true;
  }

  // 2. GDPR Right to be Forgotten / Cascading Anonymization (P0 Compliance)
  if (pathname === "/api/user/gdpr-anonymize" && req.method === "POST") {
    try {
      const data = await readLimitedJson<{ userId?: string }>(req);
      const requestedUserId = data.userId;

      // VULN-02: BOLA / IDOR protection
      // Users can only anonymize their own account unless they hold administrative compliance permissions.
      const hasComplianceAdminPermission =
        currentUser?.role === "admin" &&
        (currentUser?.permissions?.includes("compliance:admin:manage") ||
         currentUser?.permissions?.includes("user:gdpr:anonymize:all") ||
         currentUser?.permissions?.includes("identity:user:delete"));

      if (requestedUserId && requestedUserId !== currentUser.id && !hasComplianceAdminPermission) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "Forbidden: You are not authorized to anonymize another user account.",
          })
        );
        return true;
      }

      const targetUserId =
        hasComplianceAdminPermission && requestedUserId ? requestedUserId : currentUser.id;

      const result = await anonymizationOrchestrator.anonymizeUser(targetUserId);
      eventBackplane.publish("identity.user.anonymized", {
        userId: targetUserId,
        timestamp: Date.now(),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: result.success, result }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: String(err) }));
    }
    return true;
  }

  // 3. Distributed Realtime Events via Server-Sent Events (P0 Scalability)
  if (pathname === "/api/events/sse" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        nodeId: eventBackplane.getNodeId(),
        timestamp: Date.now(),
      })}\n\n`
    );
    const unsubscribe = eventBackplane.registerSseClient((event, data) => {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    });
    req.on("close", () => {
      unsubscribe();
    });
    return true;
  }

  // 4. Platform Diagnostic & Inspection endpoint
  if (pathname === "/__mosaix") {
    const allContributions = bacRegistry.flatMap((b) => b.contributions);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        {
          platform: "MosaiX Platform (Midnight Pulse)",
          version: "0.1.0",
          status: "running",
          currentUser: {
            name: currentUser.name,
            role: currentUser.role,
            allowedBacs: currentUser.allowedBacs,
            permissionsCount: currentUser.permissions.length,
          },
          activeApps: apps.map((a) => a.id),
          totalContributions: allContributions.length,
          feedPostsCount: feedStore.length,
        },
        null,
        2
      )
    );
    return true;
  }

  return false;
}
