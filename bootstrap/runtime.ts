/**
 * @mosaix/bootstrap — Runtime Execution Engine & HTTP Request Dispatcher
 * Manages HTTP request pipeline: security headers, rate limiting, static delivery, API routing, and SSR view rendering.
 */

import * as http from "node:http";
import { URL } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";

import type { ThemeMode, BacExecutionContext } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { platformSettingsService } from "@mosaix/core";

import { apps } from "../src/shell/discovery.js";
import { DynamicBacRegistry } from "../src/shell/dynamic-bac-registry.js";
import {
  getActiveUserProfile,
  getActiveSpaceProfile,
  type UserProfile,
} from "../src/shell/profiles.js";
import {
  standardRateLimiter,
  strictRateLimiter,
} from "../src/shell/rate-limiter.js";
import { bacOrchestrator } from "../src/shell/orchestrator/bac-orchestrator.js";
import {
  renderThemeStyleTag,
  generateUnifiedThemeCssVariables,
  getResolvedTheme,
} from "../src/shell/theme/theme-bridge.js";
import { renderBacAdminSafely } from "../src/shell/renderer.js";
import { handleMaintenanceGate } from "../src/server/middleware/maintenance-gate.js";
import { dispatchApiRequest } from "../src/server/api-dispatcher.js";
import { renderBacPage } from "../src/shell/pages/bac-page.js";
import { renderHomePage } from "../src/shell/pages/home-page.js";
import type { ApplicationServices } from "./services.js";

// Static MIME types (module-level: never rebuilt per request).
const STATIC_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
};

// API routes with sensitive side effects get the strict bucket.
const STRICT_RATE_LIMIT_PREFIXES = [
  "/api/user/switch",
  "/api/user/gdpr",
  "/api/auth",
  "/api/psp",
  "/api/login",
];

// Global CSS styles generator function
export function getSharedStyles(mode: ThemeMode): string {
  return `
    :root {
      ${generateUnifiedThemeCssVariables(getResolvedTheme(mode))}
      --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    body {
      font-family: var(--font-sans);
      background-color: var(--background);
      color: var(--on-surface);
    }
    .glass-card {
      background: ${mode === "light" ? "rgba(255, 255, 255, 0.7)" : "rgba(26, 28, 44, 0.7)"};
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid ${mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)"};
    }
    .sidebar-collapsed .secondary-sidebar {
      display: none !important;
    }
    .sidebar-collapsed .main-workspace {
      margin-left: 72px !important;
    }
  `;
}

function headersToRecord(
  headers: http.IncomingHttpHeaders,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(", ");
  }
  return out;
}

export function createHttpRequestHandler(services: ApplicationServices) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    try {
      // 1. Core Security Headers (S-06)
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("X-XSS-Protection", "1; mode=block");

      const parsedUrl = new URL(
        req.url || "/",
        `http://${req.headers.host || "localhost"}`,
      );
      const pathname = parsedUrl.pathname;

      // 1b. Rate limiting on API routes (S-04). Static assets are exempt.
      if (pathname.startsWith("/api/")) {
        const strict = STRICT_RATE_LIMIT_PREFIXES.some((prefix) =>
          pathname.startsWith(prefix),
        );
        const allow = (
          strict ? strictRateLimiter : standardRateLimiter
        ).middleware(pathname);
        if (!allow(req, res)) return;
      }

      // 1. Static Assets Delivery (/public/)
      if (pathname.startsWith("/public/")) {
        const publicDir = path.resolve(process.cwd(), "public");
        const safePath = path.resolve(process.cwd(), "." + pathname);
        if (!safePath.startsWith(publicDir)) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden");
          return;
        }
        if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
          const ext = path.extname(safePath).toLowerCase();
          res.writeHead(200, {
            "Content-Type": STATIC_MIME_TYPES[ext] || "application/octet-stream",
          });
          fs.createReadStream(safePath).pipe(res);
          return;
        }
      }

      // 2. Resolve User, Active Space & Theme Mode context
      const currentUser: UserProfile = await getActiveUserProfile(req, parsedUrl, services.authComposition);
      const activeSpaceProfile = getActiveSpaceProfile(req, parsedUrl);
      const currentSpace = activeSpaceProfile ? activeSpaceProfile.id : null;
      const themeCookie = (req.headers.cookie || "").match(
        /mosaix_theme_mode=([a-z-]+)/,
      );
      const requestedTheme = themeCookie ? themeCookie[1] : "";
      const currentThemeMode: ThemeMode =
        requestedTheme === "light" ||
        requestedTheme === "high-contrast" ||
        requestedTheme === "system"
          ? requestedTheme
          : "dark";
      const sharedStyles = getSharedStyles(currentThemeMode);

      // 3. Platform Maintenance Gate Middleware (FEAT-01)
      if (
        handleMaintenanceGate(
          req,
          res,
          pathname,
          currentUser.role,
          currentThemeMode,
          sharedStyles,
        )
      ) {
        return;
      }

      // 4. API Request Dispatcher
      const isApiHandled = await dispatchApiRequest(req, res, parsedUrl, {
        activeMode: currentThemeMode,
        currentUser,
        compositionOverrideManager: services.compositionOverrideManager,
        authComposition: services.authComposition,
        feedService: services.getFeedService(),
        eventBackplane: services.eventBackplane,
        anonymizationOrchestrator: services.getAnonymizationOrchestrator(),
      });
      if (isApiHandled) {
        return;
      }

      // 5. BAC Workspace Views Routing
      const matchedApp = apps.find(
        (app) => pathname === app.route || pathname.startsWith(app.route + "/"),
      );

      if (matchedApp) {
        const cleanAppId = matchedApp.id.replace(/^@apps\//, "");
        const isAllowed =
          currentUser.allowedBacs.includes("*") ||
          currentUser.allowedBacs.includes(matchedApp.id) ||
          currentUser.allowedBacs.includes(cleanAppId) ||
          (cleanAppId === "citadelle" &&
            currentUser.allowedBacs.includes("identity")) ||
          (cleanAppId === "identity" &&
            currentUser.allowedBacs.includes("citadelle"));

        if (!isAllowed) {
          res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
          <div style="font-family:sans-serif; text-align:center; padding:50px;">
            <h2 style="color:#ef4444;">Accès non autorisé</h2>
            <p>Votre profil (${escapeHtml(currentUser.roleLabel)}) n'a pas accès au module <strong>${escapeHtml(matchedApp.name)}</strong>.</p>
            <a href="/" style="color:#6366f1;">&larr; Retour à l'accueil</a>
          </div>
        `);
          return;
        }

        // Live read (D-01): never cache the plugin registry across requests.
        const bacEntry = DynamicBacRegistry.getAll().find(
          (b) => b.id === matchedApp.id,
        );
        const appContributions = bacEntry ? bacEntry.contributions : [];

        let renderedContent: string;
        const descriptor =
          (await bacOrchestrator.loadDescriptor(matchedApp.id)) ||
          bacOrchestrator.getDescriptor(matchedApp.id);

        if (descriptor) {
          const executionContext: BacExecutionContext = {
            tenantId: "default",
            spaceId: currentSpace,
            user: {
              id: currentUser.id,
              roles: [currentUser.role],
              permissions: currentUser.permissions,
            },
            theme: {
              mode: currentThemeMode === "system" ? "light" : currentThemeMode,
            },
            request: {
              path: pathname,
              query: Object.fromEntries(parsedUrl.searchParams.entries()),
              headers: headersToRecord(req.headers),
            },
          };
          try {
            const renderResult = await descriptor.render(executionContext);
            renderedContent = renderResult.contentHtml;
          } catch (err) {
            renderedContent = `<div class="p-6 text-rose-400">Erreur d'exécution du descripteur: ${escapeHtml(String(err))}</div>`;
          }
        } else if (typeof matchedApp.renderView === "function") {
          try {
            renderedContent = matchedApp.renderView(pathname);
          } catch (err) {
            renderedContent = `<div class="p-6 text-rose-400">Erreur d'exécution: ${escapeHtml(String(err))}</div>`;
          }
        } else {
          renderedContent = renderBacAdminSafely(matchedApp.id, appContributions);
        }

        const html = renderBacPage({
          activeMode: currentThemeMode,
          sharedStyles,
          themeStyle: renderThemeStyleTag(currentThemeMode),
          matchedApp,
          currentUser,
          currentSpace,
          renderedContent,
          contributionsCount: appContributions.length,
          requestUrl: req.url,
        });

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      // 6. Dynamic Default BAC Resolution & Workspace Root Routing
      const platformSettings = await platformSettingsService.getSettings();
      const defaultBacResolution = await bacOrchestrator.resolveDefaultBac(
        platformSettings,
        currentUser.allowedBacs,
      );

      if (defaultBacResolution) {
        const { descriptor } = defaultBacResolution;
        const cleanAppId = descriptor.id.replace(/^@apps\//, "");
        const bacEntry = DynamicBacRegistry.getAll().find(
          (b) => b.id === descriptor.id || b.id === cleanAppId,
        );
        const appContributions = bacEntry ? bacEntry.contributions : [];

        const executionContext: BacExecutionContext = {
          tenantId: "default",
          spaceId: currentSpace,
          user: {
            id: currentUser.id,
            roles: [currentUser.role],
            permissions: currentUser.permissions,
          },
          theme: {
            mode: currentThemeMode === "system" ? "light" : currentThemeMode,
          },
          request: {
            path: "/",
            query: Object.fromEntries(parsedUrl.searchParams.entries()),
            headers: (req.headers as Record<string, string>) || {},
          },
        };

        const renderResult = await descriptor.render(executionContext);

        const matchedApp = {
          id: descriptor.id,
          name: descriptor.name,
          route: descriptor.routePrefix,
          category: "Application Principale",
        };

        const html = renderBacPage({
          activeMode: currentThemeMode,
          sharedStyles,
          themeStyle: renderThemeStyleTag(currentThemeMode),
          matchedApp,
          currentUser,
          currentSpace,
          renderedContent: renderResult.contentHtml,
          contributionsCount: appContributions.length,
          requestUrl: req.url,
        });

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      // Fallback: If no default or fallback BAC is available, render Platform Hub
      const widgetsHtml = `
      <div class="glass-card p-4 rounded-xl space-y-2 border border-outline-variant/20">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-primary">Plateforme MosaiX</span>
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
        </div>
        <p class="text-[11px] text-on-surface-variant">Hub décentralisé d'applications et d'espaces de travail.</p>
      </div>
    `;

      const homeHtml = renderHomePage({
        activeMode: currentThemeMode,
        sharedStyles,
        currentUser,
        currentSpace,
        feedPosts: [],
        widgetsHtml,
        requestUrl: req.url,
      });

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(homeHtml);
    } catch (err: unknown) {
      console.error("[ServerError]", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        const message = err instanceof Error ? err.message : "Unknown error";
        res.end(`Internal Server Error: ${message}`);
      }
    }
  };
}
