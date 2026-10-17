/**
 * @mosaix/shell — Server Bootstrapper & Main HTTP Host
 * Modular server with maintenance gate, decoupled route dispatching, and SSR page handlers.
 */

import * as http from "node:http";
import { URL } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";

import type { ThemeMode, BacExecutionContext } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import { platformSettingsService, ConsoleLogger } from "@mosaix/core";
import { createApplication } from "../bootstrap/index.js";

// Shell services & state
import { apps } from "./shell/discovery.js";
import { DynamicBacRegistry } from "./shell/dynamic-bac-registry.js";
import {
  getActiveUserProfile,
  getActiveSpaceProfile,
  type UserProfile,
} from "./shell/profiles.js";
import {
  buildSsrAuthContext,
  type SsrAuthContext,
} from "./shell/ssr-auth-context.js";
import {
  resolveBacAccess,
  parseBacView,
  buildNavProfile,
  resolveSafeNext,
} from "./shell/bac-access.js";
import { renderLoginPage, renderRegisterPage } from "./shell/pages/auth-pages.js";
import {
  standardRateLimiter,
  strictRateLimiter,
} from "./shell/rate-limiter.js";
import { getFeedService } from "./shell/feed-service.js";
import { distributedEventBackplane } from "./shell/event-backplane.js";
import { getAnonymizationOrchestrator } from "./shell/anonymization-orchestrator.js";
import { bacOrchestrator } from "./shell/orchestrator/bac-orchestrator.js";
import {
  renderThemeStyleTag,
  generateUnifiedThemeCssVariables,
  getResolvedTheme,
} from "./shell/theme/theme-bridge.js";
import { renderBacAdminSafely } from "./shell/renderer.js";
import { PRIMARY_RAIL_SHARED_CSS } from "./shell/renderer.js";
import { getPlatformFeatureFlags } from "./shell/feature-flags.js";

// Server decoupling modules
import { handleMaintenanceGate } from "./server/middleware/maintenance-gate.js";
import { dispatchApiRequest } from "./server/api-dispatcher.js";
import { PortfolioService } from "../apps/portfolio/src/domain/portfolio-service.js";
import { ProposalService } from "../apps/portfolio/src/domain/proposal-service.js";
import { PostgresProposalRepository } from "../apps/portfolio/src/infrastructure/postgres-proposal-repository.js";
import { PostgresVendableRepository } from "../apps/portfolio/src/infrastructure/postgres-vendable-repository.js";
import { wireBacDescriptors } from "./server/bac-wiring.js";
import { renderBacPage } from "./shell/pages/bac-page.js";
import { renderHomePage } from "./shell/pages/home-page.js";

const logger = new ConsoleLogger("info", { component: "ShellServer" });
/* AUDIT-RESET a055b8e (2026-10-13) — AUCUNE PERTE DÉTECTÉE.
 * Alignement d'API ConsoleLogger + mise en forme logger.error, conforme au "build 0 erreur" de la session.
 * Fait partie du batch "and 14 more". Vérifier la signature ConsoleLogger et le boot (build + démarrage)
 * après toute restauration. */

// Single composition root (Laravel `bootstrap/app.php`): env → security →
// database (connect only, PRAGMAs awaited) → migrations fail-fast →
// composition overrides → persisted theme. Schema comes from versioned
// migrations applied via the CLI — the boot path never runs DDL or seeds.
// Fresh checkout or pending migrations? Run: pnpm mosaix migrate
// (add --seed for baseline demo data).
const app = await createApplication();
const { compositionOverrideManager } = app;
const PORT = app.env.resolvedPort;

// Initialize platform feature flags with database adapter for persistent storage
await getPlatformFeatureFlags(app.dbAdapter);

// Connect BAC descriptors to their domain services (Postgres-backed).
// A wiring failure never blocks boot: the static fallback renders honest
// empty states and the error is logged loudly.
await wireBacDescriptors(app.dbAdapter);

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
function getSharedStyles(mode: ThemeMode): string {
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
    /* Rail primaire minimisé (bug pré-existant) : .no-scrollbar manquait sur
       les pages BAC + tooltips flottants. Source unique : renderer.ts. */
    ${PRIMARY_RAIL_SHARED_CSS}
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

const server = http.createServer(async (req, res) => {
  try {
    // Inject standard OWASP security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");

    const parsedUrl = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`,
    );
    const pathname = parsedUrl.pathname;

    // 1b. Rate limiting on API routes (S-04). Static assets are exempt.
    // Sensitive endpoints get the strict bucket (15 burst, 2/s refill).
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

    // 2. Resolve User, Active Space & Theme Mode context (VULN-01: default unauthenticated role is member)
    // Single source of truth: profiles.ts (S-01/A-01). The role cookie is a
    // demo credential — never a trust boundary; production gates live in
    // SecurityGuard + isDemoMode().
    const currentUser: UserProfile = getActiveUserProfile(req, parsedUrl);
    // AUTH-07: request identity for the navbar boundary. Real sessions win;
    // demo personas only when demo mode is on; otherwise explicit anonymous
    // (auth buttons, never the user menu). Sidebar/authorization flows keep
    // using `currentUser` until AUTH-05 ports land — the navbar is the only
    // consumer of `ssrAuth` for now.
    const ssrAuth: SsrAuthContext = await buildSsrAuthContext(req, parsedUrl);
    // Navigation profile derived from the SAME access policy as the route
    // guard below (never `allowedBacs` as a competing authority). Display
    // only — enforcement happens in the guard.
    const navProfile: UserProfile = buildNavProfile(ssrAuth, apps);
    const activeSpaceProfile = await getActiveSpaceProfile(req, parsedUrl, app.dbAdapter);
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

    // 4. API Request Dispatcher (Theme, User, Flags, Compositions, Auth, Feed, GDPR, SSE)
    const isApiHandled = await dispatchApiRequest(req, res, parsedUrl, {
      activeMode: currentThemeMode,
      currentUser,
      compositionOverrideManager,
      feedService: getFeedService(app.dbAdapter),
      eventBackplane: distributedEventBackplane,
      anonymizationOrchestrator: getAnonymizationOrchestrator(app.dbAdapter),
      db: app.dbAdapter,
      buildProposalServices: (db) => {
        const portfolioService = new PortfolioService(new PostgresVendableRepository(db));
        const proposalService = new ProposalService(new PostgresProposalRepository(db), portfolioService);
        return { portfolioService, proposalService };
      },
    });
    if (isApiHandled) {
      return;
    }

    // 4b. Public auth pages (login functional, register = waiting room).
    // Authenticated/demo sessions have no business here → back to `next`.
    if (pathname === "/login" || pathname === "/register") {
      if (req.method !== "GET") {
        res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Method not allowed");
        return;
      }
      const safeNext = resolveSafeNext(parsedUrl.searchParams.get("next"));
      if (ssrAuth.kind !== "anonymous") {
        res.writeHead(302, { Location: safeNext });
        res.end();
        return;
      }
      const html =
        pathname === "/login"
          ? renderLoginPage({
              activeMode: currentThemeMode,
              sharedStyles,
              safeNext,
              requestUrl: req.url,
            })
          : renderRegisterPage({
              activeMode: currentThemeMode,
              sharedStyles,
              safeNext,
              requestUrl: req.url,
            });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    // 5. BAC Workspace Views Routing
    const matchedApp = apps.find(
      (app) => pathname === app.route || pathname.startsWith(app.route + "/"),
    );

    if (matchedApp) {
      const cleanAppId = matchedApp.id.replace(/^@apps\//, "");
      // Global BAC access policy (guest boundary): same resolver as nav
      // filtering. `?view=` normalization is shared so a request can never
      // be authorized under one interpretation and rendered under another.
      const parsedView = parseBacView(parsedUrl.searchParams);
      // Ambiguous `?view=` (repeated param) is refused outright — never
      // authorized under one interpretation and rendered under another.
      const decision = parsedView.ambiguous
        ? ssrAuth.kind === "anonymous"
          ? { kind: "login" as const }
          : { kind: "forbidden" as const }
        : resolveBacAccess(ssrAuth, cleanAppId, parsedView.view);

      if (decision.kind !== "allowed") {
        if (decision.kind === "login") {
          const here = pathname + (parsedUrl.search || "");
          res.writeHead(302, {
            Location: `/login?next=${encodeURIComponent(resolveSafeNext(here))}`,
          });
          res.end();
          return;
        }
        res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
        <div style="font-family:sans-serif; text-align:center; padding:50px;">
          <h2 style="color:#ef4444;">Accès non autorisé</h2>
          <p>Votre profil (${escapeHtml(navProfile.roleLabel)}) n'a pas accès au module <strong>${escapeHtml(matchedApp.name)}</strong>.</p>
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
      // loadDescriptor lazy-loads + caches; getDescriptor is the sync
      // re-read fallback (T-05: same contract, no I/O).
      const descriptor =
        (await bacOrchestrator.loadDescriptor(matchedApp.id)) ||
        bacOrchestrator.getDescriptor(matchedApp.id);

      if (descriptor) {
        // Least privilege for anonymous renders: BAC views must never see
        // member roles/permissions through the execution context.
        // isAuthenticated comes from the resolved session (ssrAuth), never
        // from roles (VUES-AUTHFLAG-01).
        const execUser =
          ssrAuth.kind === "anonymous"
            ? { id: "guest", roles: [] as string[], permissions: [] as string[], isAuthenticated: false as const }
            : {
                id: currentUser.id,
                roles: [currentUser.role],
                permissions: currentUser.permissions,
                isAuthenticated: true as const,
              };
        const executionContext: BacExecutionContext = {
          tenantId: "default",
          spaceId: currentSpace,
          user: execUser,
          theme: {
            // "system" has no runtime rendering — resolve to light (matches SSR default branch).
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
        requestUrl: req.url,
        auth: ssrAuth,
        navProfile,
      });

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    // 6. Dynamic Default BAC Resolution & Workspace Root Routing
    // Anonymous visitors get the public marketplace vitrine instead of the
    // personalized hub (tranche decision: `/` → `/commerce`).
    if (ssrAuth.kind === "anonymous" && pathname === "/") {
      res.writeHead(302, { Location: "/commerce" });
      res.end();
      return;
    }
    const platformSettings = await platformSettingsService.getSettings();
    const defaultBacResolution = await bacOrchestrator.resolveDefaultBac(
      platformSettings,
      currentUser.allowedBacs,
    );

    if (defaultBacResolution) {
      const { descriptor } = defaultBacResolution;
      const cleanAppId = descriptor.id.replace(/^@apps\//, "");
      // Same global policy as explicit BAC routes: the default BAC is not
      // a backdoor for anonymous visitors (e.g. unknown path rendering the
      // solara feed).
      const defaultDecision = resolveBacAccess(ssrAuth, cleanAppId, "");
      if (defaultDecision.kind === "login") {
        const here = pathname + (parsedUrl.search || "");
        res.writeHead(302, {
          Location: `/login?next=${encodeURIComponent(resolveSafeNext(here))}`,
        });
        res.end();
        return;
      }
      if (defaultDecision.kind === "forbidden") {
        res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<div style="font-family:sans-serif; text-align:center; padding:50px;"><h2 style="color:#ef4444;">Accès non autorisé</h2><a href="/" style="color:#6366f1;">&larr; Retour à l'accueil</a></div>`);
        return;
      }
      const executionContext: BacExecutionContext = {
        tenantId: "default",
        spaceId: currentSpace,
        user:
          ssrAuth.kind === "anonymous"
            ? { id: "guest", roles: [] as string[], permissions: [] as string[], isAuthenticated: false as const }
            : {
                id: currentUser.id,
                roles: [currentUser.role],
                permissions: currentUser.permissions,
                isAuthenticated: true as const,
              },
        theme: {
          // "system" has no runtime rendering — resolve to light (matches SSR default branch).
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
        requestUrl: req.url,
        auth: ssrAuth,
        navProfile,
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

    // Fallback: personalized hub is never served to anonymous visitors.
    if (ssrAuth.kind === "anonymous") {
      res.writeHead(302, { Location: "/commerce" });
      res.end();
      return;
    }
    const homeHtml = renderHomePage({
      activeMode: currentThemeMode,
      sharedStyles,
      currentUser,
      currentSpace,
      feedPosts: [],
      widgetsHtml,
      requestUrl: req.url,
      auth: ssrAuth,
      navProfile,
    });

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(homeHtml);
  } catch (err: unknown) {
    logger.error("[ServerError]", { err: String(err) });
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      const message = err instanceof Error ? err.message : "Unknown error";
      res.end(`Internal Server Error: ${message}`);
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  logger.info(`MosaiX platform host listening on http://0.0.0.0:${PORT}`);
});
