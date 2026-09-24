/**
 * @server — Central API Request Dispatcher
 * Routes incoming API requests to isolated sub-route modules.
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import type { ThemeMode } from "@mosaix/contracts";
import type { CompositionOverrideManager } from "@mosaix/core";
import { handleThemeRoutes } from "./routes/theme-routes.js";
import { handleUserAndSpaceRoutes } from "./routes/user-routes.js";
import { handleFeatureFlagRoutes } from "./routes/feature-flag-routes.js";
import { handleCompositionRoutes } from "./routes/composition-routes.js";
import { handleAuthRoutes } from "./routes/auth-routes.js";

export async function dispatchApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  context: {
    activeMode: ThemeMode;
    setActiveMode: (mode: ThemeMode) => void;
    currentUserRole: string;
    compositionOverrideManager: CompositionOverrideManager;
  }
): Promise<boolean> {
  const pathname = parsedUrl.pathname;
  if (!pathname.startsWith("/api/")) {
    return false;
  }

  // 1. Theme API
  if (await handleThemeRoutes(req, res, parsedUrl, context.activeMode, context.setActiveMode)) {
    return true;
  }

  // 2. User Role & Space switching API
  if (handleUserAndSpaceRoutes(req, res, parsedUrl)) {
    return true;
  }

  // 3. Feature Flags API
  if (await handleFeatureFlagRoutes(req, res, parsedUrl, context.currentUserRole)) {
    return true;
  }

  // 4. Composition & Block Overrides API
  if (handleCompositionRoutes(req, res, parsedUrl, context.currentUserRole, context.compositionOverrideManager)) {
    return true;
  }

  // 5. Auth & Wizard API
  if (await handleAuthRoutes(req, res, parsedUrl)) {
    return true;
  }

  return false;
}
