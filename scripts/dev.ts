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
import { DevSupervisor } from "../packages/dev-server/src/command-center/supervisor.js";

const ROOT = process.cwd();

const args = process.argv.slice(2);
const noTui = args.includes("--no-tui") || process.env.NO_TUI !== undefined;
const debounceIdx = args.indexOf("--debounce");
const debounceMs =
  debounceIdx >= 0 ? Number(args[debounceIdx + 1]) || 300 : 300;

const supervisor = new DevSupervisor({
  root: ROOT,
  apiCommand: process.platform === "win32" ? "npx.cmd" : "npx",
  apiArgs: ["tsx", "--watch", "src/start.ts"],
  mcpCommand: process.platform === "win32" ? "npx.cmd" : "npx",
  mcpArgs: ["tsx", "packages/mcp/src/stdio-server.ts"],
  watchedFiles: [".env", ".env.local"],
  debounceMs,
  noTui,
});

await supervisor.start();
