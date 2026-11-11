/**
 * @scripts/dev — MOSAIX // COMMAND CENTER entry point (`pnpm dev`).
 *
 * Supervises the platform server (`tsx --watch src/start.ts`) and the MCP
 * stdio server (`packages/mcp/src/stdio-server.ts`) with independent
 * lifecycle management, .env watching, a live event timeline, bounded logs,
 * keyboard shortcuts and graceful shutdown.
 *
 * TUI choice: hand-rolled ANSI renderer (zero new deps) instead of Ink/React —
 * deterministic in tests/CI, safe on Windows, and keeps the MCP stdio
 * protocol isolated (MCP stdout is piped + drained, never rendered).
 * Flags: --no-tui (plain text), --debounce <ms>.
 *
 * Dev-only. Production (`pnpm start`) boots once and never watches.
 */
import * as path from "node:path";
import * as fs from "node:fs";
import { DevSupervisor } from "@mosaix/command-center";
import { FileLogger } from "@mosaix/core";

const ROOT = process.cwd();

// ─── Logs du dev server vers fichier (dogfooding: FileLogger,
// zéro dépendance externe, réutilise l'interface Logger du projet) ─────
const logDir = path.join(ROOT, ".mosaix", "logs");
const fileLogger = new FileLogger("info", { component: "DevSupervisor" }, { logDir, fileName: "supervisor.log" });

const args = process.argv.slice(2);
const noTui = args.includes("--no-tui") || process.env.NO_TUI !== undefined;
const debounceIdx = args.indexOf("--debounce");
const debounceMs =
  debounceIdx >= 0 ? Number(args[debounceIdx + 1]) || 300 : 300;

// --- Flags d'export (Lot 08) ---
const exportLogsIdx = args.indexOf("--export-logs");
const exportDiagnosticsIdx = args.indexOf("--export-diagnostics");
const exportLogsPath =
  exportLogsIdx >= 0 ? args[exportLogsIdx + 1] : undefined;
const exportDiagnosticsPath =
  exportDiagnosticsIdx >= 0 ? args[exportDiagnosticsIdx + 1] : undefined;
const doExport = exportLogsPath !== undefined || exportDiagnosticsPath !== undefined;

const shouldWait = doExport ? 3000 : 0; // laisser le temps au boot de remplir l'historique

// Marque le démarrage du supervisor dans le fichier de log.
fileLogger.info("DevSupervisor starting", { root: ROOT, noTui, debounceMs, doExport });

const supervisor = new DevSupervisor({
  root: ROOT,
  apiCommand: process.platform === "win32" ? "npx.cmd" : "npx",
  apiArgs: ["tsx", "--watch", "src/start.ts"],
  mcpCommand: process.platform === "win32" ? "npx.cmd" : "npx",
  mcpArgs: ["tsx", "packages/mcp/src/stdio-server.ts"],
  watchedFiles: [".env", ".env.local"],
  debounceMs,
  noTui,
  // Le boot (createApplication + connexion DB + compilation tsx) peut
  // dépasser 25s sur une première exécution ou après modification.
  // On relève le budget de readiness pour éviter un faux RUNNING.
  readinessTimeoutMs: 120_000,
  shutdownTimeoutMs: 8000,
});

async function runExport(): Promise<void> {
  const h = supervisor.history;
  const data = h.toJSON();

  if (exportLogsPath) {
    const logsText = data.logs
      .map((l) => `[${new Date(l.at).toISOString()}] [${l.service}] [${l.stream}] ${l.text}`)
      .join("\n");
    fs.writeFileSync(exportLogsPath, logsText + "\n", { encoding: "utf8" });
    fileLogger.info(`Logs exportés vers ${exportLogsPath} (${data.logs.length} lignes)`);
  }

  if (exportDiagnosticsPath) {
    const snap = supervisor.snapshot();
    const diag = {
      generatedAt: new Date(snap.now).toISOString(),
      overall: snap.overall,
      services: snap.services.map((s) => ({
        name: s.name,
        label: s.label,
        state: s.state,
        readinessState: s.readinessState,
        readiness: s.readiness,
        pid: s.pid,
        uptimeMs: s.uptimeMs,
        restarts: s.restarts,
        lastExitCode: s.lastExitCode,
        lastSignal: s.lastSignal,
        lastBootMs: s.lastBootMs,
        lastError: s.lastError,
        startupFailure: s.startupFailure,
      })),
      diagnostics: snap.diagnostics,
      restarts: snap.restarts,
      cycles: snap.cycles,
    };
    fs.writeFileSync(exportDiagnosticsPath, JSON.stringify(diag, null, 2), { encoding: "utf8" });
    fileLogger.info(`Diagnostics exportés vers ${exportDiagnosticsPath}`);
  }

  console.log("Export terminé.");
  process.exit(0);
}

async function main(): Promise<void> {
  await supervisor.start();

  if (doExport) {
    // Attendre que le boot ait rempli un peu l'historique.
    await new Promise((resolve) => setTimeout(resolve, shouldWait));
    await runExport();
    return;
  }

  // Mode interactif normal (TUI ou texte).
  // Le supervisor tourne jusqu'à interruption (SIGINT/SIGTERM géré en interne).
}

main().catch((err) => {
  console.error("Erreur fatale du dev server:", err);
  process.exit(1);
});
