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
import { DevSupervisor } from "@mosaix/command-center";
import { FileLogger } from "@mosaix/core";

const ROOT = process.cwd();

// ─── Logs du dev server vers fichier (dogfooding: FileLogger,
// zéro dépendance externe, réutilise l'interface Logger du projet) ─────
// Le FileLogger est instancié et prêt à être branché sur les callbacks
// de log du DevSupervisor lorsque ceux-ci seront exposés (SupervisorOptions
// n'en propose pas encore). Il sert dès aujourd'hui à persister les logs
// du serveur côté `src/start.ts`.
const logDir = path.join(ROOT, ".mosaix", "logs");
const fileLogger = new FileLogger("info", { component: "DevSupervisor" }, { logDir, fileName: "supervisor.log" });

const args = process.argv.slice(2);
const noTui = args.includes("--no-tui") || process.env.NO_TUI !== undefined;
const debounceIdx = args.indexOf("--debounce");
const debounceMs =
  debounceIdx >= 0 ? Number(args[debounceIdx + 1]) || 300 : 300;

// Marque le démarrage du supervisor dans le fichier de log.
fileLogger.info("DevSupervisor starting", { root: ROOT, noTui, debounceMs });

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

await supervisor.start();
