/**
 * @mosaix/shell — Server Bootstrapper & Main HTTP Host
 * Modular server with maintenance gate, decoupled route dispatching, and SSR page handlers.
 */

import * as http from "node:http";
import { URL } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";

// @ts-ignore — BacExecutionContext exported via platform, tsc build cache may lag
import type { ThemeMode, BacExecutionContext } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
// @ts-ignore — core re-exports may lag behind src
import {
  CompositionOverrideManager,
  platformSettingsService,
  shellEntryPolicy,
  createGuestSession,
  requestDiagnosticsStore,
} from "@mosaix/core";
import type { ShellUserState } from "@mosaix/core";

// Shell services & state
import { apps } from "./shell/discovery.js";
import { bacRegistry } from "./generated-bac-registry.js";
import { USER_PROFILES, type UserProfile } from "./shell/profiles.js";
import { feedService } from "./shell/feed-service.js";
import { distributedEventBackplane } from "./shell/event-backplane.js";
import { anonymizationOrchestrator } from "./shell/anonymization-orchestrator.js";
import { loadSavedCompositionOverrides } from "./shell/editor.js";
import { bacOrchestrator } from "./shell/orchestrator/bac-orchestrator.js";
import {
  renderThemeStyleTag,
  generateUnifiedThemeCssVariables,
  getResolvedTheme,
} from "./shell/theme/theme-bridge.js";
import { renderBacAdminSafely } from "./shell/renderer.js";

// Server decoupling modules
import { handleMaintenanceGate } from "./server/middleware/maintenance-gate.js";
import { dispatchApiRequest } from "./server/api-dispatcher.js";
import { renderBacPage } from "./shell/pages/bac-page.js";
import { renderHomePage } from "./shell/pages/home-page.js";

const PORT = parseInt(process.env.APP_PORT || "3000", 10);
let activeMode: ThemeMode = "dark";

// Composition Overrides Store initialization
const compositionOverrideManager = new CompositionOverrideManager();
loadSavedCompositionOverrides(compositionOverrideManager);

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
      background: rgba(26, 28, 44, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .sidebar-collapsed .secondary-sidebar {
      display: none !important;
    }
    .sidebar-collapsed .main-workspace {
      margin-left: 72px !important;
    }
  `;
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    })
  );
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // 1. Static Assets Delivery (/public/) — ETag + gzip
  if (pathname.startsWith("/public/")) {
    const filePath = path.join(process.cwd(), pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const stat = fs.statSync(filePath);
      const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304);
        res.end();
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
      };
      const acceptEncoding = req.headers["accept-encoding"] || "";
      const shouldGzip = typeof acceptEncoding === "string" && acceptEncoding.includes("gzip") && [".js", ".css", ".svg", ".json"].includes(ext);
      const headers: Record<string, string> = {
        "Content-Type": mimeMap[ext] || "application/octet-stream",
        ETag: etag,
        "Cache-Control": "public, max-age=3600",
      };
      if (shouldGzip) headers["Content-Encoding"] = "gzip";
      res.writeHead(200, headers);
      const stream = fs.createReadStream(filePath);
      if (shouldGzip) {
        const { createGzip } = await import("node:zlib");
        stream.pipe(createGzip()).pipe(res);
      } else {
        stream.pipe(res);
      }
      return;
    }
  }

  const startHr = process.hrtime.bigint();
  const reqMethod = req.method || "GET";
  res.on("finish", () => {
    const dur = Number(process.hrtime.bigint() - startHr) / 1e6;
    console.log(`[http] ${reqMethod} ${pathname} ${res.statusCode} ${dur.toFixed(1)}ms`);
    try {
      requestDiagnosticsStore.append({ method: reqMethod, path: pathname, status: res.statusCode, dur: `${dur.toFixed(1)}ms` });
    } catch {}
  });
  // 0. Health / Ready probes (k8s) — avant tout
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", bacCount: apps.length, themeMode: activeMode, uptime: process.uptime() }));
    return;
  }
  if (pathname === "/ready") {
    const bacStates = bacOrchestrator.listDescriptors().map((d) => ({ id: d.id, enabled: d.isEnabled }));
    const allReady = bacStates.every((b) => b.enabled);
    res.writeHead(allReady ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ready: allReady, bacs: bacStates }));
    return;
  }

  // 2. Resolve User, Active Space & Theme Mode context
  const cookies = parseCookies(req.headers.cookie);
  const activeRole = cookies["mosaix_role"] || "admin";
  const currentUser: UserProfile = USER_PROFILES[activeRole] || USER_PROFILES["admin"];
  const currentSpace = cookies["mosaix_active_space"] || null;
  const currentThemeMode: ThemeMode = (cookies["mosaix_theme_mode"] as ThemeMode) || activeMode || "dark";
  const sharedStyles = getSharedStyles(currentThemeMode);

  // 3. Platform Maintenance Gate Middleware (FEAT-01)
  if (handleMaintenanceGate(req, res, pathname, currentUser.role, currentThemeMode, sharedStyles)) {
    return;
  }

  // 4. API Request Dispatcher (Theme, User, Flags, Compositions, Auth, Feed, GDPR, SSE)
  const isApiHandled = await dispatchApiRequest(req, res, parsedUrl, {
    activeMode: currentThemeMode,
    setActiveMode: (mode) => {
      activeMode = mode;
    },
    currentUser,
    compositionOverrideManager,
    feedService,
    eventBackplane: distributedEventBackplane,
    anonymizationOrchestrator,
  });
  if (isApiHandled) {
    return;
  }

  // 5. BAC Workspace Views Routing
  const matchedApp = apps.find(
    (app: any) => pathname === app.route || pathname.startsWith(app.route + "/")
  );

  if (matchedApp) {
    const cleanAppId = matchedApp.id.replace(/^@apps\//, "");
    const isAllowed =
      currentUser.allowedBacs.includes("*") ||
      currentUser.allowedBacs.includes(matchedApp.id) ||
      currentUser.allowedBacs.includes(cleanAppId) ||
      (cleanAppId === "citadelle" && currentUser.allowedBacs.includes("identity")) ||
      (cleanAppId === "identity" && currentUser.allowedBacs.includes("citadelle"));

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

    const bacEntry = bacRegistry.find((b) => b.id === matchedApp.id);
    const appContributions = bacEntry ? bacEntry.contributions : [];

    let renderedContent: string;
    if (matchedApp.render) {
      try {
        renderedContent = matchedApp.render();
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

  // 6. Shell Entry Policy — Guest vs Authenticated (centralisé, testable)
  const platformSettings = await platformSettingsService.getSettings();
  // Résolution ShellUserState : guest si pas de session/role, authenticated sinon
  const rawRole = cookies["mosaix_role"];
  const hasSession = !!cookies["mosaix_session"] || !!cookies["mosaix_user"];
  const isGuestState = !rawRole && !hasSession;
  let shellUserState: import("@mosaix/core").ShellUserState;
  let guestSetCookie: string | null = null;
  if (isGuestState) {
    let guestSid = cookies["mosaix_guest_sid"];
    if (!guestSid) {
      const guest = createGuestSession(parsedUrl.searchParams.get("locale") || undefined, undefined);
      guestSid = guest.sessionId;
      guestSetCookie = `mosaix_guest_sid=${guestSid}; Path=/; Max-Age=2592000; SameSite=Lax`;
    }
    shellUserState = { kind: "guest", guestSessionId: guestSid, locale: cookies["mosaix_locale"] };
  } else {
    shellUserState = {
      kind: "authenticated",
      userId: currentUser.id,
      roles: [currentUser.role],
      permissions: currentUser.permissions,
    };
  }

  const { shellEntryPolicy: entryPolicy } = await import("@mosaix/core");
  const entry = await entryPolicy.resolve({
    userState: shellUserState,
    settings: platformSettings,
    isBacAvailable: async (bacId: string) => {
      const d = bacOrchestrator.getDescriptor(bacId) || (await bacOrchestrator.loadDescriptor(bacId));
      return !!d && d.isEnabled && (await d.isAvailable());
    },
    isBacEnabled: (bacId: string) => {
      const d = bacOrchestrator.getDescriptor(bacId);
      return !!d?.isEnabled;
    },
    canLaunch: async (bacId: string, state) => {
      if (state.kind === "guest") return false; // Guest ne lance jamais de BAC privé par défaut
      const clean = bacId.replace(/^@apps\//, "");
      return currentUser.allowedBacs.includes("*") || currentUser.allowedBacs.includes(bacId) || currentUser.allowedBacs.includes(clean);
    },
  });

  if (guestSetCookie) {
    res.setHeader("Set-Cookie", guestSetCookie);
  }

  if (entry.kind === "guest") {
    if (entry.destination.mode === "login") {
      res.writeHead(302, { Location: entry.destination.route });
      res.end();
      return;
    }
    if (entry.destination.mode === "public-bac") {
      const descriptor = bacOrchestrator.getDescriptor(entry.destination.bacId) || (await bacOrchestrator.loadDescriptor(entry.destination.bacId));
      if (descriptor) {
        const executionContext: BacExecutionContext = {
          tenantId: "default",
          spaceId: currentSpace,
          user: { id: "guest", roles: [], permissions: [] },
          theme: { mode: currentThemeMode },
          request: { path: "/", query: Object.fromEntries(parsedUrl.searchParams.entries()), headers: (req.headers as Record<string, string>) || {} },
        };
        const renderResult = await descriptor.render(executionContext);
        const matchedApp = { id: descriptor.id, name: descriptor.name, route: descriptor.routePrefix, category: "Application Publique" };
        const bacEntry = bacRegistry.find((b) => b.id === descriptor.id);
        const html = renderBacPage({
          activeMode: currentThemeMode,
          sharedStyles,
          themeStyle: renderThemeStyleTag(currentThemeMode),
          matchedApp,
          currentUser,
          currentSpace,
          renderedContent: renderResult.contentHtml,
          contributionsCount: bacEntry ? bacEntry.contributions.length : 0,
          requestUrl: req.url,
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
    }
    // landing
    const widgetsHtml = `
    <div class="glass-card p-4 rounded-xl space-y-2 border border-outline-variant/20">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-primary">Bienvenue — MosaiX</span>
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
      </div>
      <p class="text-[11px] text-on-surface-variant">Connectez-vous pour accéder à votre espace Solara.</p>
      <a href="/identity/login" class="inline-block mt-2 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold">Se connecter</a>
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
    return;
  }

  // Authenticated → defaultBacId (Solara ici, configurable sans toucher Shell)
  const defaultBacResolution = await bacOrchestrator.resolveDefaultBac(platformSettings, currentUser.allowedBacs);

  if (defaultBacResolution) {
    const { descriptor } = defaultBacResolution;
    const cleanAppId = descriptor.id.replace(/^@apps\//, "");
    const bacEntry = bacRegistry.find((b) => b.id === descriptor.id || b.id === cleanAppId);
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
        mode: currentThemeMode,
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
});

function startServer(port: number = PORT, retries = 3): void {
  server.listen(port, () => {
    console.log(`MosaiX platform host listening on http://localhost:${port}`);
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && retries > 0) {
      console.warn(`[dev-server] Port ${port} in use, retrying ${port + 1} (${retries} left)...`);
      setTimeout(() => {
        server.close(() => startServer(port + 1, retries - 1));
      }, 500);
    } else {
      console.error(`[dev-server] Failed to bind port ${port}:`, err.message);
      process.exit(1);
    }
  });
}

function gracefulShutdown(signal: string): void {
  console.log(`[dev-server] Received ${signal}, closing...`);
  server.close(() => {
    console.log("[dev-server] HTTP server closed");
    process.exit(0);
  });
  // Force close after 5s
  setTimeout(() => {
    console.warn("[dev-server] Force closing after timeout");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();

// HMR — WS + chokidar (Vite parity)
let wss: any = null;
if (process.env.NODE_ENV !== "production") {
  (async () => {
    try {
      // @ts-ignore — ws types optional, dev-only
      const { WebSocketServer } = await import("ws");
      wss = new WebSocketServer({ server, path: "/__hmr" });
      wss.on("connection", (ws: any) => ws.send(JSON.stringify({ type: "connected", ts: Date.now() })));
      console.log("[hmr] WebSocket HMR ready on /__hmr");
    } catch {}
  })();
}
if (process.env.NODE_ENV !== "production") {
  (async () => {
    try {
      // @ts-ignore — chokidar is dev-only, may not be installed in all envs
      const chokidar = await import("chokidar");
      const watcher = chokidar.watch(["apps/*/mosaix.json", "src/shell/theme/**/*", "themes/**/*"], {
        ignoreInitial: true,
      });
      const broadcast = (payload: unknown) => {
        if (!wss) return;
        const data = JSON.stringify(payload);
        for (const client of wss.clients as Set<any>) {
          if (client.readyState === 1) {
            try {
              client.send(data);
            } catch {}
          }
        }
      };
      watcher.on("change", async (path: string) => {
        console.log(`[hmr] File changed: ${path}`);
        if (path.includes("mosaix.json")) {
          const bacId = path.split("/")[1] ? `@apps/${path.split("/")[1]}` : path;
          try {
            await bacOrchestrator.loadDescriptor(bacId);
            console.log(`[hmr] BAC reloaded: ${bacId}`);
            broadcast({ type: "update", fileChanged: path, timestamp: Date.now() });
          } catch (e: any) {
            console.warn(`[hmr] Failed to reload BAC ${bacId}`, e);
            broadcast({ type: "error", fileChanged: path, error: String(e?.message || e) });
          }
        }
        if (path.includes("theme")) {
          console.log(`[hmr] Theme file changed, next SSR will recompile`);
          broadcast({ type: "update", fileChanged: path, timestamp: Date.now() });
        }
      });
      console.log("[hmr] Watching BAC manifests & theme for HMR");
    } catch {
      // chokidar not available — skip HMR
    }
  })();
}
