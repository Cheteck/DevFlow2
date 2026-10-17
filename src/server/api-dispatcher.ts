/**
 * @server — Central API Request Dispatcher
 * Routes incoming API requests to isolated sub-route modules via an extensible handler pipeline.
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import type { ThemeMode } from "@mosaix/contracts";
import type { CompositionOverrideManager } from "@mosaix/core";
import type { UserProfile } from "../shell/profiles.js";
import type { FeedService } from "../shell/feed-service.js";
import type { DistributedEventBackplane } from "../shell/event-backplane.js";
import type { AnonymizationOrchestrator } from "../shell/anonymization-orchestrator.js";
import type { DatabasePort } from "@mosaix/ports-database";
import { sendProblemResponse } from "../shell/http-errors.js";

import { handleMaintenanceRoutes } from "./routes/maintenance-routes.js";
import { handleThemeRoutes } from "./routes/theme-routes.js";
import { handlePlatformThemeRoutes } from "./routes/platform-theme-routes.js";
import { handleUserAndSpaceRoutes } from "./routes/user-routes.js";
import { handleFeatureFlagRoutes } from "./routes/feature-flag-routes.js";
import { handleCompositionRoutes } from "./routes/composition-routes.js";
import { handleAuthRoutes } from "./routes/auth-routes.js";
import { handleSpacesProposalRoutes, type ProposalDraftService } from "./routes/spaces-routes.js";
import { handleMcpRoutes } from "./routes/mcp-routes.js";
import { handleFeedRoutes } from "./routes/feed-routes.js";
import { handleComplianceAndSystemRoutes } from "./routes/compliance-routes.js";
import { handleMobileRoutes } from "./routes/mobile-routes.js";
import { handleMetricsRoute } from "./routes/metrics-route.js";

/* AUDIT-RESET a055b8e (2026-10-13) — PERTE CONFIRMÉE PUIS RESTAURÉE (V1.3, voir git log).
 * Le wiring SELL-FLOW-02 manquait (spaces-routes.ts + test inexistants) ; route recréée,
 * enregistrée ci-dessus (6b) et couverte par tests/spaces-proposals-route.test.ts. */

export interface ProposalServices {
  portfolioService: unknown;
  proposalService: ProposalDraftService;
}

export interface ApiDispatcherContext {
  // Per-request theme resolved from the mosaix_theme_mode cookie.
  // No global mutable theme state (A-04): theme POSTs persist via cookie.
  activeMode: ThemeMode;
  currentUser: UserProfile;
  compositionOverrideManager: CompositionOverrideManager;
  feedService: FeedService;
  eventBackplane: DistributedEventBackplane;
  anonymizationOrchestrator: AnonymizationOrchestrator;
  db: DatabasePort;
  // Injected factory (OCP): avoids concrete imports in the dispatcher.
  buildProposalServices?: (db: DatabasePort) => ProposalServices;
}

export type ApiRouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  context: ApiDispatcherContext,
) => Promise<boolean> | boolean;

export class ApiRouteRegistry {
  private handlers: ApiRouteHandler[] = [];

  register(handler: ApiRouteHandler): void {
    this.handlers.push(handler);
  }

  getHandlers(): ApiRouteHandler[] {
    return [...this.handlers];
  }
}

export const apiRouteRegistry = new ApiRouteRegistry();

// System route registry (OCP): endpoints handled before the /api/ gate.
export type SystemRouteMatch = (pathname: string) => boolean;

export class SystemRouteRegistry {
  private handlers: Array<{ match: SystemRouteMatch; handler: ApiRouteHandler }> = [];

  register(match: SystemRouteMatch, handler: ApiRouteHandler): void {
    this.handlers.push({ match, handler });
  }

  getHandlers(): Array<{ match: SystemRouteMatch; handler: ApiRouteHandler }> {
    return [...this.handlers];
  }
}

export const systemRouteRegistry = new SystemRouteRegistry();

// 1. Maintenance API (FEAT-01)
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleMaintenanceRoutes(req, res, parsedUrl, ctx.currentUser),
);

// 2. Theme Switching & Preset Export/Import (THEME-14 / GAP-IHM-03)
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleThemeRoutes(
    req,
    res,
    parsedUrl,
    ctx.activeMode,
    ctx.currentUser.role,
    ctx.compositionOverrideManager,
  ),
);

// 2b. Platform theme administration (V2.3: admin-owned identity, persisted).
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handlePlatformThemeRoutes(req, res, parsedUrl, ctx.currentUser.role),
);

// 3. User Role & Space switching API
apiRouteRegistry.register((req, res, parsedUrl) =>
  handleUserAndSpaceRoutes(req, res, parsedUrl),
);

// 4. Feature Flags API
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleFeatureFlagRoutes(req, res, parsedUrl, ctx.currentUser.role),
);

// 5. Composition & Block Overrides API
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleCompositionRoutes(
    req,
    res,
    parsedUrl,
    ctx.currentUser.role,
    ctx.compositionOverrideManager,
  ),
);

// 6. Auth & Wizard API
apiRouteRegistry.register((req, res, parsedUrl) =>
  handleAuthRoutes(req, res, parsedUrl),
);

// 6b. Space seller proposals — POST /api/spaces/:spaceId/proposals (SELL-FLOW-02).
// Restored after the a055b8e loss (V1.3): repositories are thin wrappers over the
// shared DatabasePort, so per-match construction is cheap and keeps the module testable.
apiRouteRegistry.register((req, res, parsedUrl, ctx) => {
  if (!/^\/api\/spaces\/[^/]+\/proposals$/.test(parsedUrl.pathname)) {
    return false;
  }
  if (!ctx.buildProposalServices) {
    return false;
  }
  const { proposalService } = ctx.buildProposalServices(ctx.db);
  return handleSpacesProposalRoutes(req, res, parsedUrl, {
    currentUserId: ctx.currentUser.id,
    proposalService,
  });
});

// 7. Feed & Realtime Posts API
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleFeedRoutes(
    req,
    res,
    parsedUrl,
    ctx.currentUser,
    ctx.feedService,
    ctx.eventBackplane,
  ),
);

// 8. Compliance (PSP, GDPR, SSE)
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleComplianceAndSystemRoutes(
    req,
    res,
    parsedUrl,
    ctx.currentUser,
    ctx.anonymizationOrchestrator,
    ctx.eventBackplane,
  ),
);

// 9. Mobile Bridge (PKCE, FCM Push, Delta Sync, Codegen)
  apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
    handleMobileRoutes(req, res, parsedUrl, ctx.currentUser, ctx.feedService, ctx.db),
  );

// 10. MCP over Streamable HTTP (remote MCP clients)
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleMcpRoutes(req, res, parsedUrl, ctx.db),
);

// Register built-in system routes (OCP: extensible via systemRouteRegistry.register)
systemRouteRegistry.register(
  (p) => p === "/healthz",
  async (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ status: "alive", timestamp: new Date().toISOString() }));
    return true;
  },
);

systemRouteRegistry.register(
  (p) => p === "/readyz",
  async (req, res) => {
    const isReady = true;
    res.writeHead(isReady ? 200 : 503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ status: isReady ? "ready" : "not_ready", timestamp: new Date().toISOString() }));
    return true;
  },
);

systemRouteRegistry.register(
  (p) => p === "/metrics",
  async (req, res, parsedUrl) => handleMetricsRoute(req, res, parsedUrl),
);

systemRouteRegistry.register(
  (p) => p === "/.well-known/assetlinks.json",
  async (req, res, parsedUrl, ctx) =>
    handleMobileRoutes(req, res, parsedUrl, ctx.currentUser, ctx.feedService, ctx.db),
);

systemRouteRegistry.register(
  (p) => p === "/__mosaix",
  async (req, res, parsedUrl, ctx) =>
    handleComplianceAndSystemRoutes(req, res, parsedUrl, ctx.currentUser, ctx.anonymizationOrchestrator, ctx.eventBackplane),
);

export async function dispatchApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  context: ApiDispatcherContext,
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  // System routes (registered, extensible) — handled before the /api/ gate.
  for (const { match, handler } of systemRouteRegistry.getHandlers()) {
    if (match(pathname)) {
      return await handler(req, res, parsedUrl, context);
    }
  }

  if (!pathname.startsWith("/api/")) {
    return false;
  }

  for (const handler of apiRouteRegistry.getHandlers()) {
    const isHandled = await handler(req, res, parsedUrl, context);
    if (isHandled) {
      return true;
    }
  }

  // Unhandled API route fallback with RFC 7807 Problem Details
  sendProblemResponse(
    res,
    404,
    "Endpoint Not Found",
    `La ressource d'API ${pathname} n'est pas définie.`,
  );
  return true;
}
