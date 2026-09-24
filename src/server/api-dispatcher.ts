/**
 * @server — Central API Request Dispatcher
 * Routes incoming API requests to isolated sub-route modules.
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

  // 1. Maintenance API (FEAT-01)
  if (await handleMaintenanceRoutes(req, res, parsedUrl, context.currentUser)) {
    return true;
  }

  // 2. Theme Switching & Preset Export/Import (THEME-14 / GAP-IHM-03)
  if (
    await handleThemeRoutes(
      req,
      res,
      parsedUrl,
      context.activeMode,
      context.setActiveMode,
      context.currentUser.role,
      context.compositionOverrideManager
    )
  ) {
    return true;
  }

  // 3. User Role & Space switching API
  if (handleUserAndSpaceRoutes(req, res, parsedUrl)) {
    return true;
  }

  // 4. Feature Flags API
  if (await handleFeatureFlagRoutes(req, res, parsedUrl, context.currentUser.role)) {
    return true;
  }

  // 5. Composition & Block Overrides API
  if (
    handleCompositionRoutes(
      req,
      res,
      parsedUrl,
      context.currentUser.role,
      context.compositionOverrideManager
    )
  ) {
    return true;
  }

  // 6. Auth & Wizard API
  if (await handleAuthRoutes(req, res, parsedUrl)) {
    return true;
  }

  // 7. Feed & Realtime Posts API
  if (
    await handleFeedRoutes(
      req,
      res,
      parsedUrl,
      context.currentUser,
      context.feedService,
      context.eventBackplane
    )
  ) {
    return true;
  }

  // 8. Compliance (PSP, GDPR, SSE)
  if (
    await handleComplianceAndSystemRoutes(
      req,
      res,
      parsedUrl,
      context.currentUser,
      context.anonymizationOrchestrator,
      context.eventBackplane
    )
  ) {
    return true;
  }

  // Unhandled API route fallback with RFC 7807 Problem Details
  sendProblemResponse(res, 404, "Endpoint Not Found", `La ressource d'API ${pathname} n'est pas définie.`);
  return true;
}
