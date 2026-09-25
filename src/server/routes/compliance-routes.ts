/**
 * @server/routes — GDPR Compliance, Payment Webhooks, Event Streams, and Diagnostics
 * + MosaiX Monitoring Dashboard /__mosaix (HTML+JSON, BAC health, platform live, metrics, logs, events, actions)
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { pspWebhookHandler } from "../../shell/psp-webhook-handler.js";
import type { AnonymizationOrchestrator } from "../../shell/anonymization-orchestrator.js";
import type { DistributedEventBackplane } from "../../shell/event-backplane.js";
import type { UserProfile } from "../../shell/profiles.js";
import { feedStore } from "../../shell/feed-store.js";
import { apps } from "../../shell/discovery.js";
import { bacRegistry } from "../../generated-bac-registry.js";

// In-memory ring buffer for request logs (shared with start.ts via global)
const requestLogBuffer: Array<{ ts: string; method: string; path: string; status: number; dur: string }> = [];
// @ts-ignore — expose globally for start.ts logger
(globalThis as unknown as { __mosaixRequestLogBuffer: typeof requestLogBuffer }).__mosaixRequestLogBuffer = requestLogBuffer;
export function pushRequestLog(entry: { method: string; path: string; status: number; dur: string }): void {
  requestLogBuffer.push({ ts: new Date().toISOString(), ...entry });
  if (requestLogBuffer.length > 100) requestLogBuffer.shift();
}

export async function handleComplianceAndSystemRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUser: UserProfile,
  anonymizationOrchestrator: AnonymizationOrchestrator,
  eventBackplane: DistributedEventBackplane
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  // 1. PSP Payment Gateway Webhook (P0 Gateway & Security)
  if (pathname === "/api/psp/webhook" && req.method === "POST") {
    await pspWebhookHandler.handleWebhookRequest(req, res);
    return true;
  }

  // 2. GDPR Right to be Forgotten / Cascading Anonymization (P0 Compliance)
  if (pathname === "/api/user/gdpr-anonymize" && req.method === "POST") {
    let bodyStr = "";
    for await (const chunk of req) {
      bodyStr += chunk;
    }

    try {
      const data = JSON.parse(bodyStr || "{}");
      const targetUserId = data.userId || currentUser.id;
      const result = await anonymizationOrchestrator.anonymizeUser(targetUserId);
      eventBackplane.publish("identity.user.anonymized", {
        userId: targetUserId,
        timestamp: Date.now(),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: result.success, result }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: String(err) }));
    }
    return true;
  }

  // 3. Distributed Realtime Events via Server-Sent Events (P0 Scalability)
  if (pathname === "/api/events/sse" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        nodeId: eventBackplane.getNodeId(),
        timestamp: Date.now(),
      })}\n\n`
    );
    const unsubscribe = eventBackplane.registerSseClient((event, data) => {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    });
    req.on("close", () => {
      unsubscribe();
    });
    return true;
  }

  // 4. Platform Diagnostic & Monitoring Dashboard — HTML+JSON, BAC health, platform, metrics, logs, events, actions
  if (pathname === "/__mosaix" || pathname === "/__mosaix/api" || pathname.startsWith("/__mosaix/")) {
    // Sub-routes: actions
    if (pathname === "/__mosaix/api/bacs/reload" && req.method === "POST") {
      let bodyStr = "";
      for await (const chunk of req) bodyStr += chunk;
      try {
        const { bacId } = JSON.parse(bodyStr || "{}");
        const { bacOrchestrator } = await import("../../shell/orchestrator/bac-orchestrator.js");
        await bacOrchestrator.loadDescriptor(bacId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, bacId }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: String(e) }));
      }
      return true;
    }
    if (pathname === "/__mosaix/api/theme" && req.method === "POST") {
      let bodyStr = "";
      for await (const chunk of req) bodyStr += chunk;
      try {
        const { mode } = JSON.parse(bodyStr || "{}");
        const { applyThemeMode } = await import("../../shell/theme/theme-bridge.js");
        await applyThemeMode(mode);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, mode }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: String(e) }));
      }
      return true;
    }
    if (pathname === "/__mosaix/api/clear-cache" && req.method === "POST") {
      try {
        const { ssrFragmentCache } = await import("../../shell/ssr-cache.js");
        ssrFragmentCache.clear();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: String(e) }));
      }
      return true;
    }

    // Collect live data
    const allContributions = bacRegistry.flatMap((b) => b.contributions);
    const mem = process.memoryUsage();
    let platformSettings: Record<string, unknown> = {};
    let bacHealth: Array<{ id: string; enabled: boolean; available: boolean }> = [];
    try {
      const { platformSettingsService } = await import("@mosaix/core");
      platformSettings = await platformSettingsService.getSettings();
    } catch {}
    try {
      const { bacOrchestrator } = await import("../../shell/orchestrator/bac-orchestrator.js");
      const descs = bacOrchestrator.listDescriptors();
      bacHealth = await Promise.all(
        descs.map(async (d) => ({
          id: d.id,
          enabled: d.isEnabled,
          available: await d.isAvailable().catch(() => false),
        }))
      );
    } catch {}
    // Try to get theme mode
    let themeMode = "dark";
    try {
      const { getThemeMode } = await import("../../shell/theme/theme-bridge.js");
      themeMode = getThemeMode();
    } catch {}

    const diagnostics = {
      platform: "MosaiX Platform (Midnight Pulse)",
      version: "0.1.0",
      status: "running",
      uptime: Math.floor(process.uptime()),
      memory: { rss: Math.round(mem.rss / 1024 / 1024) + "MB", heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB" },
      themeMode,
      platformSettings,
      currentUser: {
        name: currentUser.name,
        role: currentUser.role,
        allowedBacs: currentUser.allowedBacs,
        permissionsCount: currentUser.permissions.length,
      },
      activeApps: apps.map((a) => a.id),
      bacHealth,
      totalContributions: allContributions.length,
      feedPostsCount: feedStore.length,
      requestLogs: [...requestLogBuffer].slice(-20).reverse(),
      hmr: { wsPath: "/__hmr", watching: ["apps/*/mosaix.json", "src/shell/theme/**/*"] },
    };

    const wantsJson = parsedUrl.searchParams.get("format") === "json" || req.headers.accept?.includes("application/json") || pathname === "/__mosaix/api";
    if (wantsJson) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(diagnostics, null, 2));
      return true;
    }

    // HTML dashboard
    const html = `<!DOCTYPE html><html lang="fr" data-theme-mode="${themeMode}" class="${themeMode === 'dark' ? 'dark' : ''}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MosaiX Monitoring — /__mosaix</title>
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
      <script>tailwind.config={darkMode:"class",theme:{extend:{colors:{surface:"#0b1326",primary:"#d0bcff"}}}}</script>
      <style>body{font-family:system-ui,sans-serif;background:#0b1326;color:#dae2fd} .card{background:#171f33;border:1px solid #2d3449;border-radius:12px;padding:16px} .ok{color:#10b981} .warn{color:#f59e0b} .err{color:#ef4444} table{width:100%;font-size:11px} th{color:#cbc3d7;text-align:left;padding:4px} td{padding:4px;border-top:1px solid #2d3449} button{padding:4px 8px;border-radius:8px;background:#d0bcff;color:#3c0091;font-weight:600;font-size:11px;cursor:pointer} button:hover{opacity:0.9}</style>
      </head><body class="p-4 max-w-6xl mx-auto space-y-4">
      <h1 style="font-size:20px;font-weight:800">MosaiX Monitoring <span style="font-size:11px;color:#cbc3d7">/__mosaix</span> <span style="font-size:10px;padding:2px 6px;border-radius:999px;background:#10b98122;color:#10b981;border:1px solid #10b98144">${diagnostics.status}</span></h1>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="card"><div style="font-size:10px;color:#cbc3d7">UPTIME</div><div style="font-size:18px;font-weight:700">${Math.floor(diagnostics.uptime/3600)}h ${Math.floor((diagnostics.uptime%3600)/60)}m</div><div style="font-size:11px;color:#cbc3d7">Heap ${diagnostics.memory.heapUsed} / RSS ${diagnostics.memory.rss}</div></div>
        <div class="card"><div style="font-size:10px;color:#cbc3d7">THEME</div><div style="font-size:18px;font-weight:700">${themeMode}</div><div style="font-size:11px;color:#cbc3d7">defaultBac: ${(platformSettings as unknown as {defaultBacId?:string})?.defaultBacId || "solara"}</div><div style="margin-top:8px;display:flex;gap:6px"><button onclick="fetch('/__mosaix/api/theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'light'})}).then(()=>location.reload())">Light</button><button onclick="fetch('/__mosaix/api/theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'dark'})}).then(()=>location.reload())">Dark</button></div></div>
        <div class="card"><div style="font-size:10px;color:#cbc3d7">HMR</div><div style="font-size:11px">WS <code>/__hmr</code> — watching<br><code>apps/*/mosaix.json</code><br><code>src/shell/theme/**/*</code></div><div style="margin-top:8px;display:flex;gap:6px"><button onclick="fetch('/__mosaix/api/clear-cache',{method:'POST'}).then(()=>location.reload())">Clear cache</button><button onclick="location.reload()">Reload</button></div></div>
      </div>
      <div class="card"><h2 style="font-weight:700;margin-bottom:8px">BAC Health (${bacHealth.length})</h2><table><thead><tr><th>BAC</th><th>Enabled</th><th>Available</th><th>Action</th></tr></thead><tbody>
        ${bacHealth.map((b) => `<tr><td>${b.id}</td><td class="${b.enabled ? 'ok' : 'err'}">${b.enabled ? '✓' : '✗'}</td><td class="${b.available ? 'ok' : 'warn'}">${b.available ? '✓' : '○'}</td><td><button onclick="fetch('/__mosaix/api/bacs/reload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bacId:'${b.id}'})}).then(r=>r.json()).then(j=>alert(j.success?'Reloaded':'Failed: '+j.error))">Reload</button></td></tr>`).join("")}
      </tbody></table></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="card"><h2 style="font-weight:700;margin-bottom:8px">Platform Settings</h2><pre style="font-size:11px;white-space:pre-wrap;max-height:200px;overflow:auto">${JSON.stringify(platformSettings, null, 2)}</pre></div>
        <div class="card"><h2 style="font-weight:700;margin-bottom:8px">Contributions (${diagnostics.totalContributions}) + Feed (${diagnostics.feedPostsCount})</h2><div style="font-size:11px;color:#cbc3d7">Apps: ${diagnostics.activeApps.join(", ")}</div><div style="font-size:11px;color:#cbc3d7">User: ${diagnostics.currentUser.name} (${diagnostics.currentUser.role}) — ${diagnostics.currentUser.permissionsCount} perms</div></div>
      </div>
      <div class="card"><h2 style="font-weight:700;margin-bottom:8px">Request Logs (last 20)</h2><table><thead><tr><th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>Dur</th></tr></thead><tbody>
        ${diagnostics.requestLogs.map((r: { ts: string; method: string; path: string; status: number; dur: string }) => `<tr><td>${new Date(r.ts).toLocaleTimeString()}</td><td>${r.method}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.path}</td><td>${r.status}</td><td>${r.dur}</td></tr>`).join("") || '<tr><td colspan="5" style="color:#cbc3d7">No logs yet</td></tr>'}
      </tbody></table></div>
      <div class="card"><h2 style="font-weight:700;margin-bottom:8px">Live Events (SSE)</h2><div id="events-log" style="font-size:11px;max-height:150px;overflow:auto;background:#060e20;padding:8px;border-radius:8px;font-family:monospace"></div><script>
        try{ const es=new EventSource('/api/events/sse'); es.onmessage=function(e){ const el=document.getElementById('events-log'); if(el){ const d=document.createElement('div'); d.textContent=new Date().toLocaleTimeString()+' '+e.data.slice(0,120); el.prepend(d); while(el.children.length>20) el.removeChild(el.lastChild); } }; es.addEventListener('catalog:product:created', function(e){ const el=document.getElementById('events-log'); if(el){ const d=document.createElement('div'); d.style.color='#10b981'; d.textContent='[catalog] '+e.data.slice(0,100); el.prepend(d);} }); }catch{}
        // Auto-refresh JSON every 5s
        setInterval(()=>{ fetch('/__mosaix?format=json').then(r=>r.json()).then(j=>{ /* could update metrics */ }).catch(()=>{}); }, 5000);
      </script></div>
      <div style="font-size:10px;color:#cbc3d7;text-align:center;padding:8px">MosaiX v0.1.0 — <a href="/__mosaix?format=json" style="color:#d0bcff">JSON</a> · <a href="/health" style="color:#d0bcff">/health</a> · <a href="/ready" style="color:#d0bcff">/ready</a> · HMR <code>/__hmr</code></div>
      </body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return true;
  }

  return false;
}
