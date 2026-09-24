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
import { sendProblemResponse } from "../shell/http-errors.js";

import { handleMaintenanceRoutes } from "./routes/maintenance-routes.js";
import { handleThemeRoutes } from "./routes/theme-routes.js";
import { handleUserAndSpaceRoutes } from "./routes/user-routes.js";
import { handleFeatureFlagRoutes } from "./routes/feature-flag-routes.js";
import { handleCompositionRoutes } from "./routes/composition-routes.js";
import { handleAuthRoutes } from "./routes/auth-routes.js";
import { handleFeedRoutes } from "./routes/feed-routes.js";
import { handleComplianceAndSystemRoutes } from "./routes/compliance-routes.js";

export interface ApiDispatcherContext {
  activeMode: ThemeMode;
  setActiveMode: (mode: ThemeMode) => void;
  currentUser: UserProfile;
  compositionOverrideManager: CompositionOverrideManager;
  feedService: FeedService;
  eventBackplane: DistributedEventBackplane;
  anonymizationOrchestrator: AnonymizationOrchestrator;
}

export type ApiRouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  context: ApiDispatcherContext
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

// 1. Maintenance API (FEAT-01)
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleMaintenanceRoutes(req, res, parsedUrl, ctx.currentUser)
);

// 2. Theme Switching & Preset Export/Import (THEME-14 / GAP-IHM-03)
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleThemeRoutes(
    req,
    res,
    parsedUrl,
    ctx.activeMode,
    ctx.setActiveMode,
    ctx.currentUser.role,
    ctx.compositionOverrideManager
  )
);

// 3. User Role & Space switching API
apiRouteRegistry.register((req, res, parsedUrl) =>
  handleUserAndSpaceRoutes(req, res, parsedUrl)
);

// 4. Feature Flags API
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleFeatureFlagRoutes(req, res, parsedUrl, ctx.currentUser.role)
);

// 5. Composition & Block Overrides API
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleCompositionRoutes(
    req,
    res,
    parsedUrl,
    ctx.currentUser.role,
    ctx.compositionOverrideManager
  )
);

// 6. Auth & Wizard API
apiRouteRegistry.register((req, res, parsedUrl) =>
  handleAuthRoutes(req, res, parsedUrl)
);

// 7. Feed & Realtime Posts API
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleFeedRoutes(
    req,
    res,
    parsedUrl,
    ctx.currentUser,
    ctx.feedService,
    ctx.eventBackplane
  )
);

// 8. Compliance (PSP, GDPR, SSE)
apiRouteRegistry.register((req, res, parsedUrl, ctx) =>
  handleComplianceAndSystemRoutes(
    req,
    res,
    parsedUrl,
    ctx.currentUser,
    ctx.anonymizationOrchestrator,
    ctx.eventBackplane
  )
);

export async function dispatchApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  context: ApiDispatcherContext
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  // System diagnostic endpoint is at /__mosaix
  if (pathname === "/__mosaix") {
    return await handleComplianceAndSystemRoutes(
      req,
      res,
      parsedUrl,
      context.currentUser,
      context.anonymizationOrchestrator,
      context.eventBackplane
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

  // Unhandled API route fallback with RFC 7807 Problem Details
  sendProblemResponse(res, 404, "Endpoint Not Found", `La ressource d'API ${pathname} n'est pas définie.`);
  return true;
}
