/**
 * @mosaix/shell — Server Bootstrapper & Main HTTP Host
 * Modular server with maintenance gate, decoupled route dispatching, and SSR page handlers.
 */

import * as http from "node:http";
import { URL } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";

import type { ThemeMode } from "@mosaix/contracts";
import { escapeHtml } from "@mosaix/support";
import {
  CompositionOverrideManager,
} from "@mosaix/core";

// Shell services & state
import { apps } from "./shell/discovery.js";
import { bacRegistry } from "./generated-bac-registry.js";
import { USER_PROFILES, type UserProfile } from "./shell/profiles.js";
import { feedService } from "./shell/feed-service.js";
import { distributedEventBackplane } from "./shell/event-backplane.js";
import { anonymizationOrchestrator } from "./shell/anonymization-orchestrator.js";
import { loadSavedCompositionOverrides } from "./shell/editor.js";
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

const PORT = parseInt(process.env.PORT || "3000", 10);
let activeMode: ThemeMode = "dark";

// Composition Overrides Store initialization
const compositionOverrideManager = new CompositionOverrideManager();
loadSavedCompositionOverrides(compositionOverrideManager);

// Global CSS styles
const sharedStyles = `
  :root {
    ${generateUnifiedThemeCssVariables(getResolvedTheme(activeMode))}
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

  // 1. Static Assets Delivery (/public/)
  if (pathname.startsWith("/public/")) {
    const filePath = path.join(process.cwd(), pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
      };
      res.writeHead(200, { "Content-Type": mimeMap[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // 2. Resolve User & Active Space context
  const cookies = parseCookies(req.headers.cookie);
  const activeRole = cookies["mosaix_role"] || "admin";
  const currentUser: UserProfile = USER_PROFILES[activeRole] || USER_PROFILES["admin"];
  const currentSpace = cookies["mosaix_active_space"] || null;

  // 3. Platform Maintenance Gate Middleware (FEAT-01)
  if (handleMaintenanceGate(req, res, pathname, currentUser.role, activeMode, sharedStyles)) {
    return;
  }

  // 4. API Request Dispatcher (Theme, User, Flags, Compositions, Auth, Feed, GDPR, SSE)
  const isApiHandled = await dispatchApiRequest(req, res, parsedUrl, {
    activeMode,
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
    (app) => pathname === app.route || pathname.startsWith(app.route + "/")
  );

  if (matchedApp) {
    const isAllowed =
      currentUser.allowedBacs.includes("*") || currentUser.allowedBacs.includes(matchedApp.id);

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
      activeMode,
      sharedStyles,
      themeStyle: renderThemeStyleTag(activeMode),
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

  // 6. Social & Workspace Home Page SSR
  const paginatedFeed = await feedService.getFeed({ limit: 15 }).catch(() => null);
  const feedPosts = paginatedFeed?.items.map((i) => ({
    id: i.id,
    author: i.author,
    authorRole: "Membre Actif",
    authorAvatar: "👤",
    bacSource: i.category || "solara",
    content: i.content,
    timestamp: new Date(i.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    likes: i.likes,
  })) || [];

  const widgetsHtml = `
    <div class="glass-card p-4 rounded-xl space-y-2 border border-outline-variant/20">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-primary">Solara Community</span>
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
      </div>
      <p class="text-[11px] text-on-surface-variant">Rejoignez les discussions citoyennes décentralisées en temps réel.</p>
    </div>
    <div class="glass-card p-4 rounded-xl space-y-2 border border-outline-variant/20">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-indigo-400">Imperia Governance</span>
        <span class="text-[10px] text-on-surface-variant font-mono">v1.0</span>
      </div>
      <p class="text-[11px] text-on-surface-variant">Participez aux scrutins et configurez les politiques de sécurité du cluster.</p>
    </div>
  `;

  const homeHtml = renderHomePage({
    activeMode,
    sharedStyles,
    currentUser,
    currentSpace,
    feedPosts,
    widgetsHtml,
    requestUrl: req.url,
  });

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(homeHtml);
});

server.listen(PORT, () => {
  console.log(`MosaiX platform host listening on http://localhost:${PORT}`);
});
