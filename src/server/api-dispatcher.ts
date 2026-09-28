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
import type { PlatformAuthComposition } from "../../bootstrap/auth-composition.js";
import { sendProblemResponse } from "../shell/http-errors.js";

import { handleMaintenanceRoutes } from "./routes/maintenance-routes.js";
import { handleThemeRoutes } from "./routes/theme-routes.js";
import { handlePlatformThemeRoutes } from "./routes/platform-theme-routes.js";
import { handleUserAndSpaceRoutes } from "./routes/user-routes.js";
import { handleFeatureFlagRoutes } from "./routes/feature-flag-routes.js";
import { handleCompositionRoutes } from "./routes/composition-routes.js";
import { handleAuthRoutes } from "./routes/auth-routes.js";
import { handleFeedRoutes } from "./routes/feed-routes.js";
import { handleComplianceAndSystemRoutes } from "./routes/compliance-routes.js";
import { handleMobileRoutes } from "./routes/mobile-routes.js";

export interface ApiDispatcherContext {
  activeMode: ThemeMode;
  currentUser: UserProfile;
  compositionOverrideManager: CompositionOverrideManager;
  authComposition?: PlatformAuthComposition;
  feedService: FeedService;
  eventBackplane: DistributedEventBackplane;
  anonymizationOrchestrator: AnonymizationOrchestrator;
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

// 1. Maintenance API
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleMaintenanceRoutes(req, res, parsedUrl, ctx.currentUser),
);

// 2. Theme Switching & Preset Export/Import
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

// 2b. Platform theme administration
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

// 6. Platform Auth & Identity API
apiRouteRegistry.register((req, res, parsedUrl, ctx) => {
  if (ctx.authComposition) {
    return handleAuthRoutes(req, res, parsedUrl, ctx.authComposition);
  }
  return false;
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

// 8. Compliance
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

// 9. Mobile Bridge
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleMobileRoutes(req, res, parsedUrl, ctx.currentUser, ctx.feedService),
);

export async function dispatchApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  context: ApiDispatcherContext,
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  if (pathname === "/healthz") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({ status: "alive", timestamp: new Date().toISOString() }),
    );
    return true;
  }

  if (pathname === "/readyz") {
    const isReady = true;
    res.writeHead(isReady ? 200 : 503, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        status: isReady ? "ready" : "not_ready",
        timestamp: new Date().toISOString(),
      }),
    );
    return true;
  }

  if (pathname === "/.well-known/assetlinks.json") {
    return await handleMobileRoutes(
      req,
      res,
      parsedUrl,
      context.currentUser,
      context.feedService,
    );
  }

  if (pathname === "/__mosaix") {
    return await handleComplianceAndSystemRoutes(
      req,
      res,
      parsedUrl,
      context.currentUser,
      context.anonymizationOrchestrator,
      context.eventBackplane,
    );
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

  sendProblemResponse(
    res,
    404,
    "Endpoint Not Found",
    `La ressource d'API ${pathname} n'est pas définie.`,
  );
  return true;
}
