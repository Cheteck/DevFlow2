import * as path from "node:path";
import * as fs from "node:fs";
import * as http from "node:http";
import { URL } from "node:url";
import { escapeHtml } from "@mosaix/support";
import { serveStaticFile } from "@mosaix/http";
import type { ThemeMode } from "@mosaix/contracts";
import { ThemeManifestSchema } from "@mosaix/schemas";
import { initDatabase } from "./shell/database-bootstrap.js";
import { SecurityGuard } from "./shell/security-guard.js";
import { AnonymizationOrchestrator } from "./shell/anonymization-orchestrator.js";
import { DistributedEventBackplane } from "./shell/event-backplane.js";
import { FeedService } from "./shell/feed-service.js";
import { standardRateLimiter, strictRateLimiter } from "./shell/rate-limiter.js";
import { sendProblemResponse } from "./shell/http-errors.js";
import { pspWebhookHandler } from "./shell/psp-webhook-handler.js";
import { renderHeadBlock, renderMobileDrawer } from "./shell/ssr-engine.js";

// Enforce production security invariants (P0)
SecurityGuard.enforceProductionConstraints();

// Initialize persistent SQLite storage (P0 WAL mode & high concurrency)
const { dbAdapter, identityStore } = initDatabase();
const anonymizationOrchestrator = new AnonymizationOrchestrator(dbAdapter);
const eventBackplane = DistributedEventBackplane.getInstance();
const feedService = new FeedService(dbAdapter);

// Initialize Shell Feed Store (database-backed)
await feedService.seedInitialFeedIfEmpty().catch((err: unknown) => {
  console.error("[Shell] Failed to seed persistent feed:", err);
});
await initFeedStore(dbAdapter).catch((err: unknown) => {
  console.error("[Shell] Failed to initialize persistent feedStore:", err);
});

// Export services
export { dbAdapter, identityStore, anonymizationOrchestrator, eventBackplane, feedService };

// Import true architectural frontend views and contributions from each BAC
import { bacRegistry } from "./generated-bac-registry.js";
// Import Theme Engine & Bridge (THEME-14)
import { createThemeRuntime, InMemoryThemeAssignmentsStore, ThemeTargetRegistry, ThemeValidationError, CompositionOverrideManager } from "@mosaix/core";
import { initThemeBridge, applyThemeMode, renderThemeStyleTag, getThemeMode } from "./shell/theme/theme-bridge.js";

// Import modular shell components (refactored from demo implementations)
import { CompositionManager } from "./shell/composition-loader.js";
import { USER_PROFILES, getActiveUserProfile, getActiveSpaceProfile } from "./shell/profiles.js";
import { feedStore, type FeedPost, initFeedStore } from "./shell/feed-store.js";
import { saveCompositionOverridesToFile, loadCompositionOverridesFromFile, SavedBlockOverride } from "./shell/editor.js";
import { apps } from "./shell/discovery.js";
import { 
  renderPrimarySidebar, 
  renderSecondarySidebar, 
  renderUserSwitcherWidget, 
  renderMobileDrawer,
  renderHeaderSearchAndDevControls,
  renderCommandPaletteModal,
  renderDevInspectorDrawer,
  renderToastContainer
} from "./shell/renderer.js";
import { platformFeatureFlags } from "./shell/feature-flags.js";

const PORT = 3000;
const HOST = process.env.HOST || "0.0.0.0";
const sharedStyles = fs.readFileSync(path.resolve(process.cwd(), "src/shell/styles.css"), "utf-8");

// Initialize Theme Runtime
const themeRegistry = new ThemeTargetRegistry();
const themeStore = new InMemoryThemeAssignmentsStore();
const themeRuntime = createThemeRuntime({
  registry: themeRegistry,
  store: themeStore,
  loadManifest: (themeId: string) => {
    if (!themeId || !/^[a-zA-Z0-9-]+$/.test(themeId)) {
      throw new Error(`[Theme Engine] Security alert: Invalid themeId '${themeId}' rejected.`);
    }

    const themePath = path.resolve(process.cwd(), "themes", themeId, "theme.json");
    const themesDir = path.resolve(process.cwd(), "themes");

    if (!themePath.startsWith(themesDir)) {
      throw new Error(`[Theme Engine] Security alert: Path traversal attempt blocked for theme '${themeId}'.`);
    }

    if (fs.existsSync(themePath)) {
      try {
        const raw = fs.readFileSync(themePath, "utf-8");
        const parsed = JSON.parse(raw);
        const result = ThemeManifestSchema.safeParse(parsed);
        if (!result.success) {
          throw new ThemeValidationError(result.error.issues);
        }
        return parsed;
      } catch (e) {
        console.error(`[Theme Engine] Failed to load manifest for theme '${themeId}':`, e);
        throw e;
      }
    }
    return undefined;
  }
});

initThemeBridge({ runtime: themeRuntime });
await applyThemeMode("dark");
console.log("[MosaiX Runtime] ThemeRuntime initialized with Midnight Pulse theme.");

const allContributions = bacRegistry.flatMap(b => b.contributions);
const compositionOverrideManager = new CompositionOverrideManager();

// Seed initial default grid layout for shell.home.widgets slot
compositionOverrideManager.setBlockOverride("application-shell", "shell.home.widgets", {
  contributionId: "mosaix:live-stats-widget",
  placementId: "p-stats",
  order: 1,
  gridSpan: 8,
  wrapper: "card",
  enabled: true
});

compositionOverrideManager.setBlockOverride("application-shell", "shell.home.widgets", {
  contributionId: "mosaix:quick-actions-widget",
  placementId: "p-actions",
  order: 2,
  gridSpan: 4,
  wrapper: "glass",
  enabled: true
});

// Load saved overrides from disk if present
loadCompositionOverridesFromFile(compositionOverrideManager);

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  let activeMode: ThemeMode = getThemeMode() || "dark";
  const currentUser = getActiveUserProfile(req, parsedUrl);
  const currentSpace = getActiveSpaceProfile(req, parsedUrl);

  // CORS headers
  const reqHost = req.headers.host || "";
  const reqOrigin = req.headers.origin || "";
  const allowedOrigin = reqOrigin && (reqOrigin.includes(reqHost) || reqOrigin.startsWith("http://localhost") || reqOrigin.startsWith("https://ais-")) ? reqOrigin : `http://${reqHost}`;
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Static Assets Handler (serves /public with streaming, ETag, and path traversal protection)
  const isStaticHandled = await serveStaticFile(req, res, {
    root: path.resolve(process.cwd(), "public"),
    maxAge: 86400,
    fallthrough: true,
  });
  if (isStaticHandled) {
    return;
  }

  // Rate Limiting Security Guard (P1 Security)
  if (pathname.startsWith("/api/")) {
    const limiter = pathname === "/api/user/gdpr-anonymize" ? strictRateLimiter : standardRateLimiter;
    if (!limiter.middleware(pathname)(req, res)) {
      return;
    }
  }

  // API Route: Switch Theme
  if (pathname === "/api/theme" && (req.method === "POST" || req.method === "GET")) {
    const requestedMode = parsedUrl.searchParams.get("mode");
    if (requestedMode && ["light", "dark", "high-contrast", "system"].includes(requestedMode)) {
      activeMode = requestedMode as ThemeMode;
      await applyThemeMode(activeMode);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, mode: activeMode }));
    return;
  }

  // API Route: Switch User Role (Sets Cookie for multi-reload persistence)
  if (pathname === "/api/user/switch") {
    const requestedRole = parsedUrl.searchParams.get("role");
    if (requestedRole && USER_PROFILES[requestedRole]) {
      res.setHeader("Set-Cookie", `mosaix_role=${requestedRole}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, role: requestedRole }));
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Rôle invalide" }));
    }
    return;
  }

  // API Route: Override Feature Flag
  if (pathname === "/api/feature-flags/override" && req.method === "POST") {
    try {
      let bodyStr = "";
      for await (const chunk of req) {
        bodyStr += chunk;
      }
      const body = JSON.parse(bodyStr || "{}");
      if (body.key && typeof body.value !== "undefined") {
        await platformFeatureFlags.setFlagValue(body.key, body.value);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, key: body.key, value: body.value }));
        return;
      }
    } catch (e) {
      console.error("Failed to override feature flag:", e);
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Payload feature flag invalide" }));
    return;
  }

  // API Route: Switch Space Context (Sets Cookie for space context switching)
  if (pathname === "/api/space/switch") {
    const requestedSpace = parsedUrl.searchParams.get("spaceId") || "";
    if (requestedSpace === "none" || !requestedSpace) {
      res.setHeader("Set-Cookie", "mosaix_active_space=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, spaceId: null }));
    } else {
      res.setHeader("Set-Cookie", `mosaix_active_space=${requestedSpace}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, spaceId: requestedSpace }));
    }
    return;
  }

  // API Routes: Declarative Runtime Compositions
  if (pathname === "/api/compositions") {
    if (req.method === "GET") {
      const compositions = CompositionManager.listCompositions();
      const active = CompositionManager.getActiveComposition();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, active: active?.id, compositions }));
      return;
    }

    if (req.method === "POST") {
      let bodyStr = "";
      req.on("data", chunk => { bodyStr += chunk; });
      req.on("end", () => {
        try {
          const data = JSON.parse(bodyStr || "{}");
          const { compositionId } = data;
          if (compositionId && CompositionManager.setActiveComposition(compositionId)) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, activeComposition: compositionId }));
            return;
          }
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Composition invalide ou introuvable." }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "JSON invalide." }));
        }
      });
      return;
    }
  }

  // API Routes: Feature Flags Management
  if (pathname === "/api/feature-flags") {
    if (req.method === "GET") {
      const flags = await platformFeatureFlags.listFlags();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, flags }));
      return;
    }

    if (req.method === "POST") {
      if (currentUser.role !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." }));
        return;
      }

      let bodyStr = "";
      req.on("data", chunk => { bodyStr += chunk; });
      req.on("end", async () => {
        try {
          const data = JSON.parse(bodyStr || "{}");
          const { key, value, description } = data;
          if (key && value !== undefined) {
            await platformFeatureFlags.setFlag(key, value, description);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, message: `Flag ${key} updated`, key, value }));
            return;
          }
        } catch {
          // ignore
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Clé ou valeur de feature flag manquante" }));
      });
      return;
    }
  }

  if (pathname === "/api/feature-flags/toggle" && req.method === "POST") {
    if (currentUser.role !== "admin") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." }));
      return;
    }

    let bodyStr = "";
    req.on("data", chunk => { bodyStr += chunk; });
    req.on("end", async () => {
      try {
        const data = JSON.parse(bodyStr || "{}");
        const { key } = data;
        if (key) {
          const current = await platformFeatureFlags.isEnabled(key, undefined, false);
          const updated = !current;
          await platformFeatureFlags.setFlag(key, updated);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: `Flag ${key} basculé à ${updated}`, key, enabled: updated }));
          return;
        }
      } catch {
        // ignore
      }
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Clé de feature flag manquante" }));
    });
    return;
  }

  // API Route: Composition Overrides (Live Block Editor)
  if (pathname === "/api/composition/override") {
    if (req.method === "POST") {
      if (currentUser.role !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." }));
        return;
      }

      let bodyStr = "";
      req.on("data", chunk => { bodyStr += chunk; });
      req.on("end", () => {
        try {
          const data = JSON.parse(bodyStr || "{}");
          const { surfaceId = "application-shell", slotId, contributionId, gridSpan, wrapper, order, enabled } = data;
          if (slotId && contributionId) {
            const currentStore = compositionOverrideManager.getStore(surfaceId);
            const existingSlot = currentStore.slotOverrides[slotId];
            const existingBlock = existingSlot?.blocks.find(b => b.contributionId === contributionId);

            compositionOverrideManager.setBlockOverride(surfaceId, slotId, {
              contributionId,
              placementId: existingBlock?.placementId || `p-${contributionId}`,
              order: typeof order === "number" ? order : (existingBlock?.order ?? 1),
              gridSpan: typeof gridSpan === "number" ? gridSpan : (existingBlock?.gridSpan ?? 6),
              wrapper: wrapper || existingBlock?.wrapper || "card",
              enabled: typeof enabled === "boolean" ? enabled : (existingBlock?.enabled ?? true)
            });

            // Persist to disk for GAP-IHM-01
            saveCompositionOverridesToFile(compositionOverrideManager, surfaceId);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, store: compositionOverrideManager.getStore(surfaceId) }));
            return;
          }
        } catch {
          // ignore
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Données de composition invalides" }));
      });
      return;
    }

    const surfaceId = parsedUrl.searchParams.get("surfaceId") || "application-shell";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ store: compositionOverrideManager.getStore(surfaceId) }));
    return;
  }

  // GAP-IHM-03: API Route for Theme Preset Export & Import
  if (pathname === "/api/theme/preset") {
    if (req.method === "POST") {
      if (currentUser.role !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." }));
        return;
      }

      let bodyStr = "";
      req.on("data", chunk => { bodyStr += chunk; });
      req.on("end", async () => {
        try {
          const data = JSON.parse(bodyStr || "{}");
          if (data.mode) {
            await applyThemeMode(data.mode as ThemeMode);
          }
          if (data.compositionStore) {
            const store = data.compositionStore as { slotOverrides?: Record<string, { blocks?: SavedBlockOverride[] }> };
            for (const [slotId, slotOverride] of Object.entries(store.slotOverrides || {})) {
              if (slotOverride && Array.isArray(slotOverride.blocks)) {
                for (const block of slotOverride.blocks) {
                  compositionOverrideManager.setBlockOverride("application-shell", slotId, block as SavedBlockOverride);
                }
              }
            }
            saveCompositionOverridesToFile(compositionOverrideManager, "application-shell");
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
          return;
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Fichier preset JSON invalide" }));
          return;
        }
      });
      return;
    }

    // GET preset JSON export
    const exportData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      mode: activeMode,
      compositionStore: compositionOverrideManager.getStore("application-shell")
    };
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=mosaix-theme-preset.json"
    });
    res.end(JSON.stringify(exportData, null, 2));
    return;
  }

  // API Route: PSP Payment Gateway Webhook (P0 Gateway & Security)
  if (pathname === "/api/psp/webhook" && req.method === "POST") {
    await pspWebhookHandler.handleWebhookRequest(req, res);
    return;
  }

  // API Route: GDPR Right to be Forgotten / Cascading Anonymization (P0 Compliance)
  if (pathname === "/api/user/gdpr-anonymize" && req.method === "POST") {
    let bodyStr = "";
    req.on("data", chunk => { bodyStr += chunk; });
    req.on("end", async () => {
      try {
        const data = JSON.parse(bodyStr || "{}");
        const targetUserId = data.userId || currentUser.id;
        const result = await anonymizationOrchestrator.anonymizeUser(targetUserId);
        eventBackplane.publish("identity.user.anonymized", { userId: targetUserId, timestamp: Date.now() });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: result.success, result }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
    });
    return;
  }

  // API Route: Distributed Realtime Events via Server-Sent Events (P0 Scalability)
  if (pathname === "/api/events/sse" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ type: "connected", nodeId: eventBackplane.getNodeId(), timestamp: Date.now() })}\n\n`);
    const unsubscribe = eventBackplane.registerSseClient((event, data) => {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    });
    req.on("close", () => {
      unsubscribe();
    });
    return;
  }

  // API Route: Feed Posts (GET/POST with Keyset Pagination & Realtime Broadcast)
  if (pathname === "/api/feed") {
    if (req.method === "POST") {
      let bodyStr = "";
      req.on("data", chunk => { bodyStr += chunk; });
      req.on("end", async () => {
        try {
          const data = JSON.parse(bodyStr || "{}");
          if (data.content && typeof data.content === "string" && data.content.trim()) {
            const newPost: FeedPost = {
              id: `post-${Date.now()}`,
              author: escapeHtml(currentUser.name),
              authorRole: escapeHtml(currentUser.roleLabel),
              authorAvatar: currentUser.avatar,
              bacSource: "solara",
              content: escapeHtml(data.content.trim()),
              timestamp: "À l'instant",
              likes: 0
            };
            feedStore.unshift(newPost);
            
            // Persist with FeedService
            await feedService.addItem({
              type: "post",
              author: currentUser.name,
              content: data.content.trim(),
              category: "solara",
              likes: 0,
            }).catch(() => null);

            // Broadcast via distributed event backplane
            eventBackplane.publish("solara.post.published", { post: newPost });

            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, post: newPost }));
            return;
          }
        } catch {
          // ignore
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Contenu invalide" }));
      });
      return;
    }

    // Keyset pagination query parsing
    const limit = parseInt(parsedUrl.searchParams.get("limit") || "20", 10);
    const cursor = parsedUrl.searchParams.get("cursor") ? parseInt(parsedUrl.searchParams.get("cursor")!, 10) : undefined;
    const category = parsedUrl.searchParams.get("category") || undefined;

    const paginated = await feedService.getFeed({ limit, cursor, category }).catch(() => null);
    if (paginated && paginated.items.length > 0) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        posts: paginated.items.map(i => ({
          id: i.id,
          author: i.author,
          authorRole: "Membre",
          authorAvatar: "👤",
          bacSource: i.category || "solara",
          content: i.content,
          timestamp: new Date(i.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          likes: i.likes,
        })),
        nextCursor: paginated.nextCursor,
        hasMore: paginated.hasMore,
      }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ posts: feedStore, hasMore: false }));
    return;
  }

  if (pathname === "/__mosaix") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      platform: "MosaiX Platform (Midnight Pulse)",
      version: "0.1.0",
      status: "running",
      currentUser: {
        name: currentUser.name,
        role: currentUser.role,
        allowedBacs: currentUser.allowedBacs,
        permissionsCount: currentUser.permissions.length
      },
      activeApps: apps.map(a => a.id),
      totalContributions: allContributions.length,
      feedPostsCount: feedStore.length
    }, null, 2));
    return;
  }

  // Unhandled API route fallback with RFC 7807 Problem Details
  if (pathname.startsWith("/api/")) {
    sendProblemResponse(res, 404, "Endpoint Not Found", `La ressource d'API ${pathname} n'est pas définie.`);
    return;
  }

  // Handle specific BAC route with RBAC check
  const matchedApp = apps.find(a => pathname === a.route || pathname.startsWith(a.route + "/") || (pathname.includes(`/tenants/`) && pathname.includes(a.route)));
  if (matchedApp && pathname !== "/") {
    const isAllowed = currentUser.allowedBacs.includes(matchedApp.id) || currentUser.allowedBacs.includes(matchedApp.id.replace(/^@apps\//, ""));
    const appContributions = allContributions.filter(c => c.ownerApp === `@apps/${matchedApp.id}` || c.ownerApp === matchedApp.id);

    res.writeHead(isAllowed ? 200 : 403, { "Content-Type": "text/html; charset=utf-8" });

    // Render Forbidden 403 if user lacks access to this BAC
    const renderedContent = isAllowed
      ? (matchedApp.renderView ? matchedApp.renderView(pathname) : `<div class="p-6">Module ${matchedApp.name}</div>`)
      : `
        <div class="p-8 text-center space-y-4 max-w-md mx-auto">
          <div class="w-16 h-16 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto text-3xl font-bold">
            🔒
          </div>
          <h2 class="text-xl font-bold text-on-surface">Accès Restreint au BAC ${matchedApp.name}</h2>
          <p class="text-xs text-on-surface-variant leading-relaxed">
            Votre profil actuel (<strong>${currentUser.name}</strong> - <em>${currentUser.roleLabel}</em>) ne possède pas les autorisations requises pour accéder au module <strong>${matchedApp.name}</strong>.
          </p>
          <div class="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <button onclick="switchUserRole('admin')" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-md cursor-pointer">
              👑 Passer Administrateur
            </button>
            <a href="/" class="px-4 py-2 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-variant/30 font-bold text-xs transition">
              Retourner à l'Accueil
            </a>
          </div>
        </div>
      `;

    res.end(`<!DOCTYPE html>
<html class="dark" lang="fr" data-theme-mode="${activeMode}">
${renderHeadBlock(matchedApp.name, activeMode, renderThemeStyleTag(activeMode), sharedStyles)}
  <script>
    (function() {
      if (localStorage.getItem('mosaix_secondary_sidebar_collapsed') === 'true') {
        document.documentElement.classList.add('sidebar-collapsed');
      }
      
      // Override standard alert with beautiful non-blocking toast notices
      window.alert = function(message) {
        let container = document.getElementById('mosaix-toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'mosaix-toast-container';
          container.className = 'fixed bottom-5 right-5 z-[9999] pointer-events-none space-y-2 max-w-sm w-full';
          document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-surface-container-high border border-outline-variant/30 shadow-2xl animate-fade-in transition-all duration-300';
        
        toast.innerHTML = '<div class="shrink-0 w-8 h-8 rounded-full bg-surface-variant/50 flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-base">info</span>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
          '<p class="text-xs font-bold text-on-surface alert-title">Notification</p>' +
          '<p class="text-[11px] text-on-surface-variant leading-relaxed mt-0.5 alert-body"></p>' +
          '</div>' +
          '<button onclick="this.parentElement.remove()" class="shrink-0 text-on-surface-variant hover:text-on-surface transition text-xs font-bold leading-none select-none">&times;</button>';
        toast.querySelector('.alert-body').textContent = message;
        
        const iconEl = toast.querySelector('.material-symbols-outlined');
        const titleEl = toast.querySelector('.alert-title');
        
        const lower = message.toLowerCase();
        if (lower.includes('erreur') || lower.includes('invalide') || lower.includes('impossible') || lower.includes('échec')) {
          iconEl.textContent = 'error';
          iconEl.className = 'material-symbols-outlined text-rose-400 text-base';
          titleEl.textContent = 'Erreur';
        } else if (lower.includes('succès') || lower.includes('réussi') || lower.includes('enregistré') || lower.includes('comptabilisé') || lower.includes('ajouté') || lower.includes('appliqué') || lower.includes('déconnexion')) {
          iconEl.textContent = 'check_circle';
          iconEl.className = 'material-symbols-outlined text-emerald-400 text-base';
          titleEl.textContent = 'Succès';
        } else if (lower.includes('avertissement') || lower.includes('attention') || lower.includes('mode maintenance')) {
          iconEl.textContent = 'warning';
          iconEl.className = 'material-symbols-outlined text-amber-400 text-base';
          titleEl.textContent = 'Attention';
        }
        
        container.appendChild(toast);
        
        setTimeout(() => {
          toast.classList.add('opacity-0', 'translate-y-2');
          setTimeout(() => toast.remove(), 300);
        }, 5000);
      };

      // Premium promise-based confirmation modal dialog
      window.mosaixConfirm = function(title, message) {
        return new Promise((resolve) => {
          let modal = document.getElementById('mosaix-confirm-modal');
          if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mosaix-confirm-modal';
            modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in transition-all duration-300';
            document.body.appendChild(modal);
          }
          
          modal.innerHTML = '<div class="bg-surface-container-high border border-outline-variant/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4 pointer-events-auto">' +
            '<div class="flex items-center gap-2 text-primary">' +
            '<span class="material-symbols-outlined text-base">help_center</span>' +
            '<h3 class="text-xs font-bold text-on-surface select-none" id="confirm-title">Confirmation</h3>' +
            '</div>' +
            '<p class="text-[11px] text-on-surface-variant leading-relaxed" id="confirm-body"></p>' +
            '<div class="flex justify-end gap-2 pt-1">' +
            '<button id="confirm-cancel" class="px-3 py-1.5 rounded-lg bg-surface-variant/50 hover:bg-surface-variant transition text-[10px] font-bold text-on-surface cursor-pointer">Annuler</button>' +
            '<button id="confirm-ok" class="px-3 py-1.5 rounded-lg bg-primary hover:brightness-110 text-white transition text-[10px] font-bold cursor-pointer">Confirmer</button>' +
            '</div>' +
            '</div>';
          
          modal.querySelector('#confirm-title').textContent = title;
          modal.querySelector('#confirm-body').textContent = message;
          modal.style.display = 'flex';
          modal.classList.remove('hidden');
          
          const cleanUp = () => {
            modal.style.display = 'none';
          };
          
          modal.querySelector('#confirm-cancel').onclick = () => {
            cleanUp();
            resolve(false);
          };
          
          modal.querySelector('#confirm-ok').onclick = () => {
            cleanUp();
            resolve(true);
          };
        });
      };
      
      // Dynamic Localisation & RTL system
      window.setLocale = function(locale) {
        localStorage.setItem('mosaix_active_locale', locale);
        document.documentElement.lang = locale;
        
        // Handle RTL layouts
        if (locale === 'ar') {
          document.documentElement.dir = 'rtl';
          document.documentElement.classList.add('rtl-mode');
        } else {
          document.documentElement.removeAttribute('dir');
          document.documentElement.classList.remove('rtl-mode');
        }
        
        // Match buttons in DOM
        ['fr', 'en', 'ar'].forEach(l => {
          const btn = document.getElementById('lang-btn-' + l);
          if (btn) {
            if (l === locale) {
              btn.className = 'px-2.5 py-1 rounded-lg transition bg-primary text-on-primary font-bold';
            } else {
              btn.className = 'px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30';
            }
          }
        });
        
        // Global translation dictionaries
        const translations = {
          fr: {
            'search-input-placeholder': 'Rechercher pulses, modules autorisés, créateurs...',
            'composer-title': 'Éditeur de Publication Solara',
            'composer-placeholder': 'Partagez un message, une idée ou lancez un sondage sur Solara...',
            'publish-btn-text': 'Publier sur Solara',
            'live-editor-text': 'Live Block Editor'
          },
          en: {
            'search-input-placeholder': 'Search pulses, authorized modules, creators...',
            'composer-title': 'Solara Publication Composer',
            'composer-placeholder': 'Share a message, an idea, or start a poll on Solara...',
            'publish-btn-text': 'Publish on Solara',
            'live-editor-text': 'Live Block Editor'
          },
          ar: {
            'search-input-placeholder': 'ابحث عن النبضات، الوحدات المصرحة، المبدعين...',
            'composer-title': 'محرر منشورات سولارا المتقدم',
            'composer-placeholder': 'شارك رسالة أو فكرة أو ابدأ استطلاعًا على سولارا...',
            'publish-btn-text': 'انشر الآن على سولارا',
            'live-editor-text': 'محرر الكتل المباشر'
          }
        };
        
        const dict = translations[locale] || translations.fr;
        
        // Translate search placeholders
        const searchInput = document.getElementById('shell-search-input');
        if (searchInput) searchInput.placeholder = dict['search-input-placeholder'];
        
        // Translate live editor label
        const liveEditorLabel = document.getElementById('live-editor-btn-label');
        if (liveEditorLabel) liveEditorLabel.textContent = dict['live-editor-text'];
        
        // Translate composer elements
        const composerTitle = document.getElementById('shell-composer-title');
        if (composerTitle) composerTitle.textContent = dict['composer-title'];
        
        const composerText = document.getElementById('composer-text');
        if (composerText) composerText.placeholder = dict['composer-placeholder'];
        
        const publishBtn = document.getElementById('publish-btn-text');
        if (publishBtn) publishBtn.textContent = dict['publish-btn-text'];
      };
      
      // Auto-init on startup
      setTimeout(() => {
        const activeLocale = localStorage.getItem('mosaix_active_locale') || 'fr';
        window.setLocale(activeLocale);
      }, 50);
    })();
  </script>
</head>
<body class="bg-background text-on-surface min-h-screen font-sans antialiased">
  
  <div class="flex min-h-screen">
    
    <!-- PRIMARY SIDEBAR (RBAC FILTERED) -->
    ${renderPrimarySidebar(currentUser, matchedApp.route, currentSpace)}

    <!-- SECONDARY CONTEXTUAL SIDEBAR (PERMISSION FILTERED) -->
    ${renderSecondarySidebar(currentUser, matchedApp.id, req.url || matchedApp.route, currentSpace)}

    <!-- MOBILE NAVIGATION DRAWER -->
    ${renderMobileDrawer(currentUser, matchedApp.route, activeMode)}

    <!-- MAIN WORKSPACE AREA -->
    <div class="main-workspace flex-1 flex flex-col min-w-0 md:ml-[72px] lg:ml-[336px]">
      
      <!-- TOP BAR WITH USER SWITCHER -->
      <header class="h-[72px] sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 px-4 sm:px-6 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          <!-- Mobile Menu Trigger -->
          <button onclick="toggleMobileDrawer()" class="md:hidden p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Menu Principal">
            <span class="material-symbols-outlined text-base">menu</span>
          </button>

          <!-- Toggle sidebar button -->
          <button onclick="toggleSecondarySidebar()" class="hidden lg:flex p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Masquer/Afficher le panneau latéral">
            <span class="material-symbols-outlined text-base">menu_open</span>
          </button>
          <a href="/" class="p-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-all text-xs font-semibold shrink-0">
            &larr; <span class="hidden sm:inline">Accueil</span>
          </a>
          <h1 class="font-bold text-sm sm:text-base text-on-surface truncate">${escapeHtml(matchedApp.name)}</h1>
          <span class="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">${matchedApp.category}</span>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          ${renderHeaderSearchAndDevControls()}

          <!-- Dynamic Language Selector -->
          <div class="hidden lg:flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs" id="mosaix-lang-selector">
            <button onclick="setLocale('fr')" id="lang-btn-fr" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">FR</button>
            <button onclick="setLocale('en')" id="lang-btn-en" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">EN</button>
            <button onclick="setLocale('ar')" id="lang-btn-ar" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">AR</button>
          </div>

          <div class="hidden lg:block h-6 w-px bg-outline-variant/30"></div>

          <!-- Dynamic Theme Toggle -->
          <div class="hidden lg:flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs">
            <button onclick="setTheme('light')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'light' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Light</button>
            <button onclick="setTheme('dark')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'dark' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Dark</button>
            <button onclick="setTheme('high-contrast')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'high-contrast' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Contrast</button>
          </div>

          <div class="hidden lg:block h-6 w-px bg-outline-variant/30"></div>

          <!-- USER SWITCHER WIDGET -->
          ${renderUserSwitcherWidget(currentUser, currentSpace)}
        </div>
      </header>

      <!-- CONTENT AREA -->
      <main class="p-6 max-w-7xl w-full mx-auto space-y-6">
        <div class="glass-card rounded-2xl p-6 space-y-6">
          <div class="bac-content-section">
            ${renderedContent}
          </div>

          <div class="pt-4 border-t border-outline-variant/20 flex justify-between items-center text-xs text-on-surface-variant">
            <span>Contrats enregistrés : <strong class="text-on-surface">${appContributions.length} contributions</strong></span>
            <a href="/" class="text-primary hover:underline font-semibold">&larr; Retour au réseau MosaiX</a>
          </div>
        </div>
      </main>

    </div>
  </div>

  <script>
    async function setTheme(mode) {
      document.documentElement.setAttribute('data-theme-mode', mode);
      try {
        await fetch('/api/theme?mode=' + mode, { method: 'POST' });
      } catch (e) {}
    }

    async function switchUserRole(role) {
      try {
        await fetch('/api/user/switch?role=' + role);
        window.location.reload();
      } catch (e) {}
    }

    async function switchActiveSpace(spaceId) {
      try {
        await fetch('/api/space/switch?spaceId=' + spaceId);
        window.location.reload();
      } catch (e) {}
    }

    function toggleSecondarySidebar() {
      const isCollapsed = document.documentElement.classList.toggle('sidebar-collapsed');
      localStorage.setItem('mosaix_secondary_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    }

    function filterSecondarySidebar(query) {
      const q = (query || '').toLowerCase().trim();
      const clearBtn = document.getElementById('secondary-sidebar-filter-clear');
      if (clearBtn) {
        if (q) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      const container = document.getElementById('mosaix-slot-shell-sidebar-secondary');
      if (!container) return;
      const items = container.querySelectorAll('.sidebar-nav-item');
      let visibleCount = 0;
      items.forEach(item => {
        const text = (item.getAttribute('data-search') || item.textContent || '').toLowerCase();
        if (!q || text.includes(q)) {
          item.classList.remove('hidden');
          visibleCount++;
        } else {
          item.classList.add('hidden');
        }
      });
      const emptyMsg = document.getElementById('secondary-sidebar-empty-state');
      if (emptyMsg) {
        if (visibleCount === 0 && q) {
          emptyMsg.classList.remove('hidden');
        } else {
          emptyMsg.classList.add('hidden');
        }
      }
    }

    function clearSecondarySidebarFilter() {
      const input = document.getElementById('secondary-sidebar-filter');
      if (input) {
        input.value = '';
        filterSecondarySidebar('');
        input.focus();
      }
    }

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const inp = document.getElementById('secondary-sidebar-filter');
        if (inp) {
          e.preventDefault();
          inp.focus();
        }
      }
      if (e.key === 'Escape') {
        const inp = document.getElementById('secondary-sidebar-filter');
        if (inp && document.activeElement === inp) {
          clearSecondarySidebarFilter();
          inp.blur();
        }
      }
    });
  </script>
  ${renderMobileDrawer(apps.map(a => `<a href="${a.route}" class="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-variant/40 transition"><span>${a.icon}</span><span>${a.name}</span></a>`).join(''))}
</body>
</html>`);
    return;
  }

  // Social Shell Home / Feed View
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!DOCTYPE html>
<html class="dark" lang="fr" data-theme-mode="${activeMode}">
${renderHeadBlock("Midnight Pulse", activeMode, renderThemeStyleTag(activeMode), sharedStyles)}
  <script>
    (function() {
      if (localStorage.getItem('mosaix_secondary_sidebar_collapsed') === 'true') {
        document.documentElement.classList.add('sidebar-collapsed');
      }
      
      // Override standard alert with beautiful non-blocking toast notices
      window.alert = function(message) {
        let container = document.getElementById('mosaix-toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'mosaix-toast-container';
          container.className = 'fixed bottom-5 right-5 z-[9999] pointer-events-none space-y-2 max-w-sm w-full';
          document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-surface-container-high border border-outline-variant/30 shadow-2xl animate-fade-in transition-all duration-300';
        
        toast.innerHTML = '<div class="shrink-0 w-8 h-8 rounded-full bg-surface-variant/50 flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-base">info</span>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
          '<p class="text-xs font-bold text-on-surface alert-title">Notification</p>' +
          '<p class="text-[11px] text-on-surface-variant leading-relaxed mt-0.5 alert-body"></p>' +
          '</div>' +
          '<button onclick="this.parentElement.remove()" class="shrink-0 text-on-surface-variant hover:text-on-surface transition text-xs font-bold leading-none select-none">&times;</button>';
        toast.querySelector('.alert-body').textContent = message;
        
        const iconEl = toast.querySelector('.material-symbols-outlined');
        const titleEl = toast.querySelector('.alert-title');
        
        const lower = message.toLowerCase();
        if (lower.includes('erreur') || lower.includes('invalide') || lower.includes('impossible') || lower.includes('échec')) {
          iconEl.textContent = 'error';
          iconEl.className = 'material-symbols-outlined text-rose-400 text-base';
          titleEl.textContent = 'Erreur';
        } else if (lower.includes('succès') || lower.includes('réussi') || lower.includes('enregistré') || lower.includes('comptabilisé') || lower.includes('ajouté') || lower.includes('appliqué') || lower.includes('déconnexion')) {
          iconEl.textContent = 'check_circle';
          iconEl.className = 'material-symbols-outlined text-emerald-400 text-base';
          titleEl.textContent = 'Succès';
        } else if (lower.includes('avertissement') || lower.includes('attention') || lower.includes('mode maintenance')) {
          iconEl.textContent = 'warning';
          iconEl.className = 'material-symbols-outlined text-amber-400 text-base';
          titleEl.textContent = 'Attention';
        }
        
        container.appendChild(toast);
        
        setTimeout(() => {
          toast.classList.add('opacity-0', 'translate-y-2');
          setTimeout(() => toast.remove(), 300);
        }, 5000);
      };

      // Premium promise-based confirmation modal dialog
      window.mosaixConfirm = function(title, message) {
        return new Promise((resolve) => {
          let modal = document.getElementById('mosaix-confirm-modal');
          if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mosaix-confirm-modal';
            modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in transition-all duration-300';
            document.body.appendChild(modal);
          }
          
          modal.innerHTML = '<div class="bg-surface-container-high border border-outline-variant/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4 pointer-events-auto">' +
            '<div class="flex items-center gap-2 text-primary">' +
            '<span class="material-symbols-outlined text-base">help_center</span>' +
            '<h3 class="text-xs font-bold text-on-surface select-none" id="confirm-title">Confirmation</h3>' +
            '</div>' +
            '<p class="text-[11px] text-on-surface-variant leading-relaxed" id="confirm-body"></p>' +
            '<div class="flex justify-end gap-2 pt-1">' +
            '<button id="confirm-cancel" class="px-3 py-1.5 rounded-lg bg-surface-variant/50 hover:bg-surface-variant transition text-[10px] font-bold text-on-surface cursor-pointer">Annuler</button>' +
            '<button id="confirm-ok" class="px-3 py-1.5 rounded-lg bg-primary hover:brightness-110 text-white transition text-[10px] font-bold cursor-pointer">Confirmer</button>' +
            '</div>' +
            '</div>';
          
          modal.querySelector('#confirm-title').textContent = title;
          modal.querySelector('#confirm-body').textContent = message;
          modal.style.display = 'flex';
          modal.classList.remove('hidden');
          
          const cleanUp = () => {
            modal.style.display = 'none';
          };
          
          modal.querySelector('#confirm-cancel').onclick = () => {
            cleanUp();
            resolve(false);
          };
          
          modal.querySelector('#confirm-ok').onclick = () => {
            cleanUp();
            resolve(true);
          };
        });
      };
      
      // Dynamic Localisation & RTL system
      window.setLocale = function(locale) {
        localStorage.setItem('mosaix_active_locale', locale);
        document.documentElement.lang = locale;
        
        // Handle RTL layouts
        if (locale === 'ar') {
          document.documentElement.dir = 'rtl';
          document.documentElement.classList.add('rtl-mode');
        } else {
          document.documentElement.removeAttribute('dir');
          document.documentElement.classList.remove('rtl-mode');
        }
        
        // Match buttons in DOM
        ['fr', 'en', 'ar'].forEach(l => {
          const btn = document.getElementById('lang-btn-' + l);
          if (btn) {
            if (l === locale) {
              btn.className = 'px-2.5 py-1 rounded-lg transition bg-primary text-on-primary font-bold';
            } else {
              btn.className = 'px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30';
            }
          }
        });
        
        // Global translation dictionaries
        const translations = {
          fr: {
            'search-input-placeholder': 'Rechercher pulses, modules autorisés, créateurs...',
            'composer-title': 'Éditeur de Publication Solara',
            'composer-placeholder': 'Partagez un message, une idée ou lancez un sondage sur Solara...',
            'publish-btn-text': 'Publier sur Solara',
            'live-editor-text': 'Live Block Editor'
          },
          en: {
            'search-input-placeholder': 'Search pulses, authorized modules, creators...',
            'composer-title': 'Solara Publication Composer',
            'composer-placeholder': 'Share a message, an idea, or start a poll on Solara...',
            'publish-btn-text': 'Publish on Solara',
            'live-editor-text': 'Live Block Editor'
          },
          ar: {
            'search-input-placeholder': 'ابحث عن النبضات، الوحدات المصرحة، المبدعين...',
            'composer-title': 'محرر منشورات سولارا المتقدم',
            'composer-placeholder': 'شارك رسالة أو فكرة أو ابدأ استطلاعًا على سولارا...',
            'publish-btn-text': 'انشر الآن على سولارا',
            'live-editor-text': 'محرر الكتل المباشر'
          }
        };
        
        const dict = translations[locale] || translations.fr;
        
        // Translate search placeholders
        const searchInput = document.getElementById('shell-search-input');
        if (searchInput) searchInput.placeholder = dict['search-input-placeholder'];
        
        // Translate live editor label
        const liveEditorLabel = document.getElementById('live-editor-btn-label');
        if (liveEditorLabel) liveEditorLabel.textContent = dict['live-editor-text'];
        
        // Translate composer elements
        const composerTitle = document.getElementById('shell-composer-title');
        if (composerTitle) composerTitle.textContent = dict['composer-title'];
        
        const composerText = document.getElementById('composer-text');
        if (composerText) composerText.placeholder = dict['composer-placeholder'];
        
        const publishBtn = document.getElementById('publish-btn-text');
        if (publishBtn) publishBtn.textContent = dict['publish-btn-text'];
      };
      
      // Auto-init on startup
      setTimeout(() => {
        const activeLocale = localStorage.getItem('mosaix_active_locale') || 'fr';
        window.setLocale(activeLocale);
      }, 50);
    })();
  </script>
</head>
<body class="bg-background text-on-surface min-h-screen font-sans antialiased selection:bg-primary/30 selection:text-primary">

  <div class="flex min-h-screen">

    <!-- 1. PRIMARY SIDEBAR (RBAC FILTERED) -->
    ${renderPrimarySidebar(currentUser, "/", currentSpace)}

    <!-- 2. SECONDARY CONTEXTUAL SIDEBAR (PERMISSION FILTERED) -->
    ${renderSecondarySidebar(currentUser, "shell_home", req.url || "/", currentSpace)}

    <!-- MOBILE NAVIGATION DRAWER -->
    ${renderMobileDrawer(currentUser, "/", activeMode)}

    <!-- 3. MAIN CONTENT CONTAINER -->
    <div class="main-workspace flex-1 flex flex-col min-w-0 md:ml-[72px] lg:ml-[336px]">
      
      <!-- TOP NAVIGATION BAR WITH USER SWITCHER -->
      <header class="h-[72px] sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4">
        <!-- Mobile Menu Trigger -->
        <button onclick="toggleMobileDrawer()" class="md:hidden p-2 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0" title="Menu Principal">
          <span class="material-symbols-outlined text-base">menu</span>
        </button>

        <!-- Collapse Sidebar Trigger -->
        <button onclick="toggleSecondarySidebar()" class="hidden lg:flex p-2.5 rounded-xl hover:bg-surface-variant/40 transition text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0 mr-2" title="Masquer/Afficher le panneau latéral">
          <span class="material-symbols-outlined text-base">menu_open</span>
        </button>

        <div class="flex-1 max-w-xl">
          <div class="relative group">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span class="material-symbols-outlined text-on-surface-variant group-focus-within:text-primary transition-colors">search</span>
            </div>
            <input id="shell-search-input" class="w-full bg-surface-variant/30 border border-outline-variant/20 rounded-full py-2 pl-11 pr-4 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:bg-surface-variant/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all outline-none" placeholder="Rechercher pulses, modules autorisés, créateurs..." type="text">
            <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div class="flex gap-1">
                <kbd class="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant bg-surface rounded border border-outline-variant/20">⌘K</kbd>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 ml-auto">
          ${renderHeaderSearchAndDevControls()}

          <!-- CS-Cart UniTheme Style Live Block Editor Toggle -->
          <button id="live-editor-toggle-btn" onclick="toggleLiveBlockEditor()" class="px-2.5 sm:px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm">
            <span class="material-symbols-outlined text-sm">dashboard_customize</span>
            <span class="hidden md:inline" id="live-editor-btn-label">Live Block Editor</span>
          </button>

          <div class="h-6 w-px bg-outline-variant/30"></div>

          <!-- Dynamic Language Selector -->
          <div class="hidden lg:flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs" id="mosaix-lang-selector">
            <button onclick="setLocale('fr')" id="lang-btn-fr" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">FR</button>
            <button onclick="setLocale('en')" id="lang-btn-en" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">EN</button>
            <button onclick="setLocale('ar')" id="lang-btn-ar" class="px-2.5 py-1 rounded-lg transition text-on-surface-variant hover:bg-surface-variant/30 font-semibold cursor-pointer">AR</button>
          </div>

          <div class="hidden lg:block h-6 w-px bg-outline-variant/30"></div>

          <!-- Dynamic Theme Toggle -->
          <div class="hidden lg:flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl text-xs">
            <button onclick="setTheme('light')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'light' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Light</button>
            <button onclick="setTheme('dark')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'dark' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Dark</button>
            <button onclick="setTheme('high-contrast')" class="px-2.5 py-1 rounded-lg transition ${activeMode === 'high-contrast' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'}">Contrast</button>
          </div>

          <div class="hidden lg:block h-6 w-px bg-outline-variant/30"></div>

          <!-- USER SWITCHER WIDGET -->
          ${renderUserSwitcherWidget(currentUser, currentSpace)}
        </div>
      </header>

      <!-- MAIN FEED SECTION -->
      <main class="flex-1 w-full overflow-hidden">
        <div class="h-full overflow-y-auto">
          <!-- BAC Directory -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            ${apps.map(app => {
              const cleanId = app.id.replace(/^@apps\//, "");
              const isAllowed = currentUser.allowedBacs.includes(app.id) || currentUser.allowedBacs.includes(cleanId);
              
              return `
                <div class="glass-card rounded-2xl p-5 border ${isAllowed ? 'border-primary/20' : 'border-outline-variant/10'} flex flex-col justify-between gap-4 glass-hover-glow transition-all duration-300">
                  <div class="space-y-3">
                    <!-- Icon & Title -->
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-surface-container/60 border border-outline-variant/10 flex items-center justify-center text-xl shrink-0">
                        ${app.icon}
                      </div>
                      <div class="min-w-0">
                        <h3 class="font-bold text-sm text-on-surface truncate">${app.name}</h3>
                        <p class="text-[10px] text-on-surface-variant/80 font-medium">
                          ${app.category} <span class="mx-1">·</span> ${app.route}
                        </p>
                      </div>
                    </div>
                    
                    <!-- Description -->
                    <p class="text-xs text-on-surface-variant leading-relaxed line-clamp-2">
                      ${app.description}
                    </p>
                  </div>

                  <!-- Footer Actions -->
                  <div class="flex items-center justify-between border-t border-outline-variant/10 pt-3 text-[11px]">
                    <!-- Authorization status -->
                    <span class="flex items-center gap-1.5 font-semibold ${isAllowed ? 'text-emerald-400' : 'text-on-surface-variant/60'}">
                      <span class="material-symbols-outlined text-sm">${isAllowed ? 'check_circle' : 'lock'}</span>
                      ${isAllowed ? 'Autorisé' : 'Accès Restreint'}
                    </span>

                    <!-- Launch Button -->
                    ${isAllowed ? `
                      <a href="${app.route}" class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary hover:brightness-110 font-bold text-xs shadow-md transition whitespace-nowrap">
                        Lancer le BAC
                      </a>
                    ` : `
                      <button onclick="switchUserRole('admin')" class="px-3.5 py-1.5 rounded-xl bg-surface-variant/40 hover:bg-surface-variant/80 text-on-surface-variant font-bold text-xs transition whitespace-nowrap">
                        Débloquer
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </main>

        <!-- RIGHT SIDEBAR (SYSTEM & RBAC STATUS) -->
        <aside class="hidden xl:flex w-80 shrink-0 flex-col gap-6">
          
          <!-- RBAC Status Card -->
          <div class="glass-card rounded-2xl p-5 flex flex-col gap-3 glass-hover-glow">
            <div class="flex justify-between items-center mb-1">
              <h3 class="font-bold text-sm text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-base">verified_user</span>
                Statut d'Accès RBAC
              </h3>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${currentUser.badgeClass}">${currentUser.roleLabel}</span>
            </div>
            <div class="space-y-2 text-xs text-on-surface-variant">
              <p>• BACs autorisés : <strong class="text-on-surface">${currentUser.allowedBacs.length} / ${apps.length}</strong></p>
              <p>• Droits spécifiques : <strong class="text-on-surface">${currentUser.permissions.length} privilèges</strong></p>
              <div class="pt-2 border-t border-outline-variant/10 text-[11px]">
                <p class="font-semibold text-on-surface mb-1">BACs accessibles :</p>
                <div class="flex flex-wrap gap-1">
                  ${currentUser.allowedBacs.map(bac => `<span class="px-1.5 py-0.5 bg-surface-variant/50 rounded text-[10px] text-primary">${bac}</span>`).join("")}
                </div>
              </div>
            </div>
          </div>

          <!-- Trending Topics -->
          <div class="glass-card rounded-2xl p-5 flex flex-col gap-3 glass-hover-glow">
            <div class="flex justify-between items-center mb-1">
              <h3 class="font-bold text-sm text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-base">trending_up</span>
                Tendances MosaiX
              </h3>
            </div>
            <div class="flex flex-col gap-3">
              <div class="flex items-start justify-between group cursor-pointer hover:bg-surface-variant/20 p-2 -mx-2 rounded-lg transition-colors">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span> Gouvernance
                  </span>
                  <span class="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">#ImperiaVote</span>
                  <span class="text-[10px] text-on-surface-variant/70">12.5k pulses</span>
                </div>
                <span class="material-symbols-outlined text-on-surface-variant/50 text-sm group-hover:text-primary transition-colors">arrow_outward</span>
              </div>

              <div class="flex items-start justify-between group cursor-pointer hover:bg-surface-variant/20 p-2 -mx-2 rounded-lg transition-colors">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Réseau
                  </span>
                  <span class="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">Solara ECHoS</span>
                  <span class="text-[10px] text-on-surface-variant/70">8.2k pulses</span>
                </div>
                <span class="material-symbols-outlined text-on-surface-variant/50 text-sm group-hover:text-primary transition-colors">arrow_outward</span>
              </div>
            </div>
          </div>

        </aside>

      </main>

    </div>
  </div>

  <!-- UniTheme Live Theme Customizer Drawer Panel -->
  <div id="theme-customizer-drawer" class="fixed inset-y-0 right-0 w-80 sm:w-96 bg-surface-container-high/95 backdrop-blur-2xl border-l border-primary/30 z-50 shadow-2xl transition-transform transform translate-x-full flex flex-col">
    <!-- Drawer Header -->
    <div class="p-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-variant/30">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-xl animate-pulse">palette</span>
        <div>
          <h3 class="font-bold text-sm text-on-surface">Éditeur de Thème Live</h3>
          <p class="text-[10px] text-on-surface-variant">Personnalisation visuelle UniTheme & Layouts</p>
        </div>
      </div>
      <button onclick="toggleThemeCustomizerDrawer()" class="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 cursor-pointer">
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    </div>

    <!-- Drawer Navigation Tabs -->
    <div class="flex border-b border-outline-variant/20 bg-surface-variant/10 text-xs font-semibold">
      <button onclick="switchCustomizerTab('theme')" id="tab-btn-theme" class="flex-1 py-2.5 text-center text-primary border-b-2 border-primary cursor-pointer transition">
        Palette
      </button>
      <button onclick="switchCustomizerTab('layout')" id="tab-btn-layout" class="flex-1 py-2.5 text-center text-on-surface-variant hover:text-on-surface cursor-pointer transition">
        Layout
      </button>
      <button onclick="switchCustomizerTab('blocks')" id="tab-btn-blocks" class="flex-1 py-2.5 text-center text-on-surface-variant hover:text-on-surface cursor-pointer transition">
        Blocs
      </button>
    </div>

    <!-- Drawer Body -->
    <div class="p-4 flex-1 overflow-y-auto space-y-5 text-xs text-on-surface">
      
      <!-- TAB 1: PALETTE & THEMES -->
      <div id="customizer-tab-theme" class="space-y-4">
        <div>
          <label class="font-bold text-[11px] text-on-surface-variant uppercase tracking-wider block mb-2">Thèmes Natifs</label>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="setTheme('dark')" class="p-2 rounded-xl border border-outline-variant/30 bg-surface-variant/30 hover:border-primary/50 text-left cursor-pointer flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-indigo-500"></span>
              <span>Midnight Pulse</span>
            </button>
            <button onclick="setTheme('emerald')" class="p-2 rounded-xl border border-outline-variant/30 bg-surface-variant/30 hover:border-primary/50 text-left cursor-pointer flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span>Emerald Matrix</span>
            </button>
            <button onclick="setTheme('amber')" class="p-2 rounded-xl border border-outline-variant/30 bg-surface-variant/30 hover:border-primary/50 text-left cursor-pointer flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-amber-500"></span>
              <span>Cyber Amber</span>
            </button>
            <button onclick="setTheme('light')" class="p-2 rounded-xl border border-outline-variant/30 bg-surface-variant/30 hover:border-primary/50 text-left cursor-pointer flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-sky-400"></span>
              <span>Nordic Light</span>
            </button>
          </div>
        </div>

        <div>
          <label class="font-bold text-[11px] text-on-surface-variant uppercase tracking-wider block mb-2">Couleur d'Accentuation Personnalisée</label>
          <div class="flex items-center gap-3 bg-surface-variant/30 p-2.5 rounded-xl border border-outline-variant/20">
            <input type="color" id="primary-color-picker" value="#6366f1" onchange="applyCustomPrimaryColor(this.value)" class="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent">
            <div>
              <span id="primary-color-hex" class="font-mono text-xs font-bold text-primary">#6366f1</span>
              <p class="text-[10px] text-on-surface-variant">Applique instantanément la variable --primary</p>
            </div>
          </div>
        </div>

        <div>
          <label class="font-bold text-[11px] text-on-surface-variant uppercase tracking-wider block mb-2">Arrondi des Bordures (Border Radius)</label>
          <input type="range" min="0" max="24" value="16" id="border-radius-slider" oninput="applyBorderRadius(this.value)" class="w-full accent-primary cursor-pointer">
          <div class="flex justify-between text-[10px] text-on-surface-variant/70 mt-1">
            <span>Carré (0px)</span>
            <span id="radius-val" class="font-bold text-primary">16px</span>
            <span>Rond (24px)</span>
          </div>
        </div>
      </div>

      <!-- TAB 2: LAYOUT & SPACING -->
      <div id="customizer-tab-layout" class="space-y-4 hidden">
        <div>
          <label class="font-bold text-[11px] text-on-surface-variant uppercase tracking-wider block mb-2">Espacement des Blocs (Grid Gap)</label>
          <select onchange="applyGridGap(this.value)" class="w-full bg-surface-variant/50 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-semibold text-on-surface cursor-pointer">
            <option value="gap-2">Serré (8px)</option>
            <option value="gap-4" selected>Normal (16px)</option>
            <option value="gap-6">Aéré (24px)</option>
            <option value="gap-8">Très Spacieux (32px)</option>
          </select>
        </div>

        <div>
          <label class="font-bold text-[11px] text-on-surface-variant uppercase tracking-wider block mb-2">Largeur Maximale de la Page</label>
          <select onchange="applyContainerMaxWidth(this.value)" class="w-full bg-surface-variant/50 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-semibold text-on-surface cursor-pointer">
            <option value="max-w-5xl">Compact (1024px)</option>
            <option value="max-w-7xl" selected>Standard (1280px)</option>
            <option value="max-w-[1536px]">Large (1536px)</option>
            <option value="max-w-full">Plein Écran (100%)</option>
          </select>
        </div>
      </div>

      <!-- TAB 3: BLOCKS MANAGER -->
      <div id="customizer-tab-blocks" class="space-y-4 hidden">
        <label class="font-bold text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1">Slot: shell.home.widgets</label>
        
        <div class="bg-surface-variant/20 border border-outline-variant/20 rounded-xl p-3 space-y-2">
          <div class="flex items-center justify-between font-bold text-xs text-primary">
            <span>📊 Live Stats Widget</span>
            <input type="checkbox" checked onchange="toggleBlockVisibility('mosaix-live-stats-widget', this.checked)" class="accent-primary cursor-pointer">
          </div>
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span class="text-on-surface-variant">Largeur:</span>
              <select onchange="updateBlockGridSpan('shell.home.widgets', 'mosaix:live-stats-widget', parseInt(this.value))" class="w-full bg-surface-variant/50 border border-outline-variant/20 rounded-lg p-1 text-[11px]">
                <option value="4">4 Cols (33%)</option>
                <option value="6">6 Cols (50%)</option>
                <option value="8" selected>8 Cols (66%)</option>
                <option value="12">12 Cols (100%)</option>
              </select>
            </div>
            <div>
              <span class="text-on-surface-variant">Style:</span>
              <select onchange="updateBlockWrapper('shell.home.widgets', 'mosaix:live-stats-widget', this.value)" class="w-full bg-surface-variant/50 border border-outline-variant/20 rounded-lg p-1 text-[11px]">
                <option value="card" selected>Carte Glass</option>
                <option value="glass">Flou Dépoli</option>
                <option value="flat">Plat</option>
                <option value="bordered">Bordure Fluo</option>
              </select>
            </div>
          </div>
        </div>

        <div class="bg-surface-variant/20 border border-outline-variant/20 rounded-xl p-3 space-y-2">
          <div class="flex items-center justify-between font-bold text-xs text-primary">
            <span>⚡ Quick Actions Widget</span>
            <input type="checkbox" checked onchange="toggleBlockVisibility('mosaix-quick-actions-widget', this.checked)" class="accent-primary cursor-pointer">
          </div>
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span class="text-on-surface-variant">Largeur:</span>
              <select onchange="updateBlockGridSpan('shell.home.widgets', 'mosaix:quick-actions-widget', parseInt(this.value))" class="w-full bg-surface-variant/50 border border-outline-variant/20 rounded-lg p-1 text-[11px]">
                <option value="4" selected>4 Cols (33%)</option>
                <option value="6">6 Cols (50%)</option>
                <option value="8">8 Cols (66%)</option>
                <option value="12">12 Cols (100%)</option>
              </select>
            </div>
            <div>
              <span class="text-on-surface-variant">Style:</span>
              <select onchange="updateBlockWrapper('shell.home.widgets', 'mosaix:quick-actions-widget', this.value)" class="w-full bg-surface-variant/50 border border-outline-variant/20 rounded-lg p-1 text-[11px]">
                <option value="card">Carte Glass</option>
                <option value="glass" selected>Flou Dépoli</option>
                <option value="flat">Plat</option>
                <option value="bordered">Bordure Fluo</option>
              </select>
            </div>
          </div>
        </div>

        <div class="bg-surface-variant/20 border border-outline-variant/20 rounded-xl p-3 space-y-2">
          <div class="flex items-center justify-between font-bold text-xs text-indigo-400">
            <span>🏛️ Imperia Scrutin Widget</span>
            <input type="checkbox" checked onchange="toggleBlockVisibility('imperia-active-ballots-widget', this.checked)" class="accent-indigo-500 cursor-pointer">
          </div>
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span class="text-on-surface-variant">Largeur:</span>
              <select onchange="updateBlockGridSpan('shell.home.widgets', 'imperia:active-ballots-widget', parseInt(this.value))" class="w-full bg-surface-variant/50 border border-outline-variant/20 rounded-lg p-1 text-[11px]">
                <option value="4">4 Cols (33%)</option>
                <option value="6" selected>6 Cols (50%)</option>
                <option value="8">8 Cols (66%)</option>
                <option value="12">12 Cols (100%)</option>
              </select>
            </div>
            <div>
              <span class="text-on-surface-variant">Style:</span>
              <select onchange="updateBlockWrapper('shell.home.widgets', 'imperia:active-ballots-widget', this.value)" class="w-full bg-surface-variant/50 border border-outline-variant/20 rounded-lg p-1 text-[11px]">
                <option value="card" selected>Carte Glass</option>
                <option value="glass">Flou Dépoli</option>
                <option value="flat">Plat</option>
                <option value="bordered">Bordure Fluo</option>
              </select>
            </div>
          </div>
        </div>

        <div class="bg-surface-variant/20 border border-outline-variant/20 rounded-xl p-3 space-y-2">
          <div class="flex items-center justify-between font-bold text-xs text-purple-400">
            <span>🛒 Commerce Offre Deal Widget</span>
            <input type="checkbox" checked onchange="toggleBlockVisibility('commerce-daily-deal-widget', this.checked)" class="accent-purple-500 cursor-pointer">
          </div>
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span class="text-on-surface-variant">Largeur:</span>
              <select onchange="updateBlockGridSpan('shell.home.widgets', 'commerce:daily-deal-widget', parseInt(this.value))" class="w-full bg-surface-variant/50 border border-outline-variant/20 rounded-lg p-1 text-[11px]">
                <option value="4">4 Cols (33%)</option>
                <option value="6" selected>6 Cols (50%)</option>
                <option value="8">8 Cols (66%)</option>
                <option value="12">12 Cols (100%)</option>
              </select>
            </div>
            <div>
              <span class="text-on-surface-variant">Style:</span>
              <select onchange="updateBlockWrapper('shell.home.widgets', 'commerce:daily-deal-widget', this.value)" class="w-full bg-surface-variant/50 border border-outline-variant/20 rounded-lg p-1 text-[11px]">
                <option value="card">Carte Glass</option>
                <option value="glass" selected>Flou Dépoli</option>
                <option value="flat">Plat</option>
                <option value="bordered">Bordure Fluo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Drawer Footer Actions -->
    <div class="p-4 border-t border-outline-variant/20 bg-surface-variant/30 flex flex-col gap-2">
      <button onclick="saveThemeConfiguration()" class="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:brightness-110 cursor-pointer">
        <span class="material-symbols-outlined text-sm">save</span>
        Enregistrer la Configuration
      </button>

      <div class="grid grid-cols-2 gap-2">
        <button onclick="exportThemePreset()" class="py-2 rounded-xl bg-surface-variant/50 hover:bg-surface-variant/80 border border-outline-variant/30 text-on-surface text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition">
          <span class="material-symbols-outlined text-xs">download</span>
          Exporter Preset
        </button>

        <label class="py-2 rounded-xl bg-surface-variant/50 hover:bg-surface-variant/80 border border-outline-variant/30 text-on-surface text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition">
          <span class="material-symbols-outlined text-xs">upload</span>
          <span>Importer Preset</span>
          <input type="file" accept=".json" onchange="importThemePreset(this)" class="hidden">
        </label>
      </div>

      <button onclick="resetThemeConfiguration()" class="w-full py-1.5 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:text-on-surface text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer">
        <span class="material-symbols-outlined text-xs">restart_alt</span>
        Réinitialiser aux paramètres d'usine
      </button>
    </div>
  </div>

  <script>
    let isLiveEditorActive = false;

    function exportThemePreset() {
      window.location.href = '/api/theme/preset';
    }

    async function importThemePreset(input) {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const res = await fetch('/api/theme/preset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        const result = await res.json();
        if (result.success) {
          alert('Preset de thème et de composition importé avec succès !');
          window.location.reload();
        } else {
          alert("Erreur lors de l'importation : " + (result.error || "Format invalide"));
        }
      } catch (e) {
        alert('Fichier JSON invalide');
      }
    }

    function selectPostType(type) {
      const pollFields = document.getElementById('solara-poll-fields');
      const textBtn = document.getElementById('post-type-btn-text');
      const mediaBtn = document.getElementById('post-type-btn-media');
      const pollBtn = document.getElementById('post-type-btn-poll');

      if (pollFields) {
        pollFields.classList.toggle('hidden', type !== 'poll');
      }

      [
        { btn: textBtn, isCurrent: type === 'text' },
        { btn: mediaBtn, isCurrent: type === 'media' },
        { btn: pollBtn, isCurrent: type === 'poll' }
      ].forEach(({ btn, isCurrent }) => {
        if (btn) {
          btn.className = isCurrent
            ? 'px-2.5 py-1 rounded-lg bg-primary text-on-primary cursor-pointer transition'
            : 'px-2.5 py-1 rounded-lg text-on-surface-variant hover:text-on-surface cursor-pointer transition';
        }
      });
    }

    function toggleThemeCustomizerDrawer() {
      const drawer = document.getElementById('theme-customizer-drawer');
      if (drawer) {
        drawer.classList.toggle('translate-x-full');
      }
    }

    function switchCustomizerTab(tab) {
      ['theme', 'layout', 'blocks'].forEach(t => {
        const el = document.getElementById('customizer-tab-' + t);
        const btn = document.getElementById('tab-btn-' + t);
        if (el) el.classList.toggle('hidden', t !== tab);
        if (btn) {
          btn.classList.toggle('text-primary', t === tab);
          btn.classList.toggle('border-b-2', t === tab);
          btn.classList.toggle('border-primary', t === tab);
          btn.classList.toggle('text-on-surface-variant', t !== tab);
        }
      });
    }

    function applyCustomPrimaryColor(colorHex) {
      document.documentElement.style.setProperty('--primary', colorHex);
      const hexSpan = document.getElementById('primary-color-hex');
      if (hexSpan) hexSpan.textContent = colorHex;
    }

    function applyBorderRadius(radiusPx) {
      document.documentElement.style.setProperty('--radius', radiusPx + 'px');
      const valSpan = document.getElementById('radius-val');
      if (valSpan) valSpan.textContent = radiusPx + 'px';
    }

    function applyGridGap(gapClass) {
      const grid = document.querySelector('.grid-cols-12');
      if (grid) {
        grid.className = grid.className.replace(/gap-[0-9]+/, gapClass);
      }
    }

    function applyContainerMaxWidth(maxWClass) {
      const main = document.querySelector('main');
      if (main) {
        main.className = main.className.replace(/max-w-[^\\s]+/, maxWClass);
      }
    }

    function toggleBlockVisibility(blockIdSuffix, isVisible) {
      const blockEl = document.getElementById('block-' + blockIdSuffix);
      if (blockEl) {
        blockEl.classList.toggle('hidden', !isVisible);
      }
    }

    function saveThemeConfiguration() {
      const btn = event.target.closest('button');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Enregistré !';
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
      }
    }

    function resetThemeConfiguration() {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--radius');
      window.location.reload();
    }

    function toggleLiveBlockEditor() {
      isLiveEditorActive = !isLiveEditorActive;
      toggleThemeCustomizerDrawer();

      const btn = document.getElementById('live-editor-toggle-btn');
      const slots = document.querySelectorAll('[data-mosaix-slot]');
      const tb1 = document.getElementById('toolbar-mosaix-live-stats-widget');
      const tb2 = document.getElementById('toolbar-mosaix-quick-actions-widget');

      if (btn) {
        btn.classList.toggle('bg-primary/30', isLiveEditorActive);
        btn.classList.toggle('border-primary', isLiveEditorActive);
        btn.innerHTML = isLiveEditorActive
          ? '<span class="material-symbols-outlined text-sm animate-spin">settings</span> Mode Éditeur Actif'
          : '<span class="material-symbols-outlined text-sm">dashboard_customize</span> Live Block Editor';
      }

      slots.forEach(slot => {
        slot.classList.toggle('p-2', isLiveEditorActive);
        slot.classList.toggle('border-2', isLiveEditorActive);
        slot.classList.toggle('border-dashed', isLiveEditorActive);
        slot.classList.toggle('border-primary/50', isLiveEditorActive);
        slot.classList.toggle('rounded-2xl', isLiveEditorActive);
        slot.classList.toggle('bg-primary/5', isLiveEditorActive);
      });

      if (tb1) tb1.classList.toggle('hidden', !isLiveEditorActive);
      if (tb2) tb2.classList.toggle('hidden', !isLiveEditorActive);
    }

    async function updateBlockGridSpan(slotId, contributionId, gridSpan) {
      const blockElementId = 'block-' + contributionId.replace(':', '-');
      const el = document.getElementById(blockElementId);
      if (el) {
        el.className = el.className.replace(/sm:col-span-[0-9]+/, 'sm:col-span-' + gridSpan);
      }

      try {
        await fetch('/api/composition/override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surfaceId: 'application-shell',
            slotId,
            contributionId,
            gridSpan
          })
        });
      } catch (e) {
        console.error('Failed to update grid span:', e);
      }
    }

    async function updateBlockWrapper(slotId, contributionId, wrapper) {
      try {
        await fetch('/api/composition/override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surfaceId: 'application-shell',
            slotId,
            contributionId,
            wrapper
          })
        });
      } catch (e) {
        console.error('Failed to update wrapper:', e);
      }
    }

    function toggleMobileDrawer() {
      const drawer = document.getElementById('mobile-drawer');
      if (drawer) drawer.classList.toggle('hidden');
    }

    async function setTheme(mode) {
      document.documentElement.setAttribute('data-theme-mode', mode);
      try {
        await fetch('/api/theme?mode=' + mode, { method: 'POST' });
      } catch (e) {}
    }

    async function switchUserRole(role) {
      try {
        await fetch('/api/user/switch?role=' + role);
        window.location.reload();
      } catch (e) {}
    }

    async function switchActiveSpace(spaceId) {
      try {
        await fetch('/api/space/switch?spaceId=' + spaceId);
        window.location.reload();
      } catch (e) {}
    }

    function toggleSecondarySidebar() {
      const isCollapsed = document.documentElement.classList.toggle('sidebar-collapsed');
      localStorage.setItem('mosaix_secondary_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    }

    function filterSecondarySidebar(query) {
      const q = (query || '').toLowerCase().trim();
      const clearBtn = document.getElementById('secondary-sidebar-filter-clear');
      if (clearBtn) {
        if (q) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      const container = document.getElementById('mosaix-slot-shell-sidebar-secondary');
      if (!container) return;
      const items = container.querySelectorAll('.sidebar-nav-item');
      let visibleCount = 0;
      items.forEach(item => {
        const text = (item.getAttribute('data-search') || item.textContent || '').toLowerCase();
        if (!q || text.includes(q)) {
          item.classList.remove('hidden');
          visibleCount++;
        } else {
          item.classList.add('hidden');
        }
      });
      const emptyMsg = document.getElementById('secondary-sidebar-empty-state');
      if (emptyMsg) {
        if (visibleCount === 0 && q) {
          emptyMsg.classList.remove('hidden');
        } else {
          emptyMsg.classList.add('hidden');
        }
      }
    }

    function clearSecondarySidebarFilter() {
      const input = document.getElementById('secondary-sidebar-filter');
      if (input) {
        input.value = '';
        filterSecondarySidebar('');
        input.focus();
      }
    }

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const inp = document.getElementById('secondary-sidebar-filter');
        if (inp) {
          e.preventDefault();
          inp.focus();
        }
      }
      if (e.key === 'Escape') {
        const inp = document.getElementById('secondary-sidebar-filter');
        if (inp && document.activeElement === inp) {
          clearSecondarySidebarFilter();
          inp.blur();
        }
      }
    });

    async function publishPost() {
      const input = document.getElementById('composer-text');
      if (!input || !input.value.trim()) return;

      const content = input.value.trim();
      input.value = '';

      try {
        const res = await fetch('/api/feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (data.success && data.post) {
          const stream = document.getElementById('feed-stream');
          if (stream) {
            const article = document.createElement('article');
            article.className = "glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3 glass-hover-glow transition-all animate-fade-in";
            article.innerHTML = \`
              <div class="flex justify-between items-start">
                <div class="flex gap-3 items-center">
                  <div class="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/20 bg-indigo-500/20 flex items-center justify-center text-lg">
                    \${data.post.authorAvatar}
                  </div>
                  <div>
                    <h3 class="font-body-md font-bold text-on-surface hover:text-primary transition-colors text-xs sm:text-sm">\${data.post.author}</h3>
                    <p class="font-label-md text-[11px] text-on-surface-variant">\${data.post.authorRole} • \${data.post.timestamp}</p>
                  </div>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">Nouveau</span>
              </div>
              <div class="text-xs sm:text-sm text-on-surface leading-relaxed px-1">
                \${data.post.content}
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                <span class="text-xs text-primary font-bold">⚡ Juste publié</span>
                <span class="text-[10px] text-on-surface-variant/70">Propulsé par Solara Social Engine</span>
              </div>
            \`;
            stream.prepend(article);
          }
        }
      } catch (e) {
        console.error("Failed to publish post:", e);
      }
    }

    // Global Toast Notification Helper
    window.showMosaixToast = function(message, type = 'info') {
      const container = document.getElementById('mosaix-toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      const isSuccess = type === 'success';
      const isError = type === 'error';
      toast.className = 'px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl border flex items-center gap-2.5 pointer-events-auto transition-all duration-300 animate-fade-in ' + (isSuccess ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' : isError ? 'bg-red-950/90 text-red-300 border-red-500/30' : 'bg-surface-container-highest text-on-surface border-outline-variant/30');
      toast.innerHTML = '<span class="material-symbols-outlined text-base">' + (isSuccess ? 'check_circle' : isError ? 'error' : 'info') + '</span><span>' + message + '</span>';
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    };

    // Command Palette Client Functions
    function openCommandPalette() {
      const modal = document.getElementById('mosaix-cmd-palette');
      const input = document.getElementById('mosaix-cmd-input');
      if (modal) {
        modal.classList.remove('hidden');
        if (input) {
          input.value = '';
          filterCommandPalette('');
          setTimeout(() => input.focus(), 50);
        }
      }
    }

    function closeCommandPalette() {
      const modal = document.getElementById('mosaix-cmd-palette');
      if (modal) modal.classList.add('hidden');
    }

    function filterCommandPalette(query) {
      const q = (query || '').toLowerCase().trim();
      const items = document.querySelectorAll('.cmd-item');
      items.forEach(item => {
        const text = item.textContent?.toLowerCase() || '';
        if (!q || text.includes(q)) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    }

    function handleCommandPaletteKeydown(e) {
      if (e.key === 'Escape') {
        closeCommandPalette();
      }
    }

    // Dev Inspector Client Functions
    function openDevInspector() {
      const modal = document.getElementById('mosaix-dev-inspector');
      if (modal) modal.classList.remove('hidden');
    }

    function closeDevInspector() {
      const modal = document.getElementById('mosaix-dev-inspector');
      if (modal) modal.classList.add('hidden');
    }

    function switchDevTab(tabName) {
      ['bacs', 'flags', 'system'].forEach(t => {
        const content = document.getElementById('dev-tab-content-' + t);
        const btn = document.getElementById('dev-tab-btn-' + t);
        if (content && btn) {
          if (t === tabName) {
            content.classList.remove('hidden');
            btn.classList.add('border-primary', 'text-primary');
            btn.classList.remove('border-transparent', 'text-on-surface-variant');
          } else {
            content.classList.add('hidden');
            btn.classList.remove('border-primary', 'text-primary');
            btn.classList.add('border-transparent', 'text-on-surface-variant');
          }
        }
      });
    }

    async function toggleFeatureFlag(flagKey, enabled) {
      try {
        const res = await fetch('/api/feature-flags/override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: flagKey, value: enabled })
        });
        const data = await res.json();
        if (data.success) {
          showMosaixToast('Feature Flag ' + flagKey + ' : ' + (enabled ? 'Activé' : 'Désactivé'), 'success');
        } else {
          showMosaixToast('Erreur mise à jour flag', 'error');
        }
      } catch (e) {
        showMosaixToast('Erreur réseau', 'error');
      }
    }

    // Keyboard Shortcuts Listener
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        openDevInspector();
      }
    });
  </script>
  ${renderMobileDrawer(apps.map(a => `<a href="${a.route}" class="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-variant/40 transition"><span>${a.icon}</span><span>${a.name}</span></a>`).join(''))}
  ${renderCommandPaletteModal()}
  ${renderDevInspectorDrawer()}
  ${renderToastContainer()}
</body>
</html>`);
});

server.listen(PORT, HOST, () => {
  console.log(`[MosaiX Runtime] Social Shell listening at http://${HOST}:${PORT}`);
  console.log(`[MosaiX Runtime] Aggregated ${allContributions.length} contribution contracts across ${apps.length} BAC frontends.`);
});
