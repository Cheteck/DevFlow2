/**
 * @scripts/dev — dev supervisor: runs the platform with code watch and
 * restarts it when dotenv files change.
 *
 * Why: `tsx --watch` only watches imported source files, never `.env`.
 * Since secrets now load from `.env` at boot (see `loadEnvFile`), editing
 * `.env` without a restart silently keeps stale config. This supervisor
 * respawns the child so the new env is picked up.
 *
 * Dev-only. Production (`pnpm start`) boots once and never watches.
 */
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
// Keep in sync with `loadEnvFile()` defaults in @mosaix/core.
const WATCHED_ENV_FILES = [".env", ".env.local"];
const RESTART_DEBOUNCE_MS = 300;

let child: ChildProcess | null = null;
let restarting = false;
let stopped = false;

function startChild(): void {
  if (stopped) return;
  // Static command (no user input) — shell:true resolves the tsx bin
  // on Windows (.cmd) and POSIX alike.
  child = spawn("tsx --watch src/start.ts", {
    stdio: "inherit",
    shell: true,
    cwd: ROOT,
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    child = null;
    if (stopped || restarting) return;
    console.log(
      `[dev] server exited (code=${code ?? "?"} signal=${signal ?? "?"}). Waiting for changes… (Ctrl+C to quit)`,
    );
  });
}

function restart(reason: string): void {
  if (stopped || restarting || !child) {
    if (!child && !stopped) startChild();
    return;
  }
  restarting = true;
  console.log(`[dev] ${reason} — restarting server…`);
  child.once("exit", () => {
    restarting = false;
    startChild();
  });
  child.kill();
}

let debounce: NodeJS.Timeout | null = null;
function scheduleRestart(file: string): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => restart(`${file} changed`), RESTART_DEBOUNCE_MS);
}

for (const file of WATCHED_ENV_FILES) {
  const filePath = path.join(ROOT, file);
  // fs.watch throws when the file doesn't exist yet — poll for it instead
  // so a later-created `.env.local` is still picked up.
  try {
    if (fs.existsSync(filePath)) {
      fs.watch(filePath, () => scheduleRestart(file));
      console.log(`[dev] watching ${file} for changes`);
    } else {
      const watcher = fs.watch(path.dirname(filePath), (event, name) => {
        if (name === path.basename(filePath)) {
          watcher.close();
          scheduleRestart(file);
          try {
            fs.watch(filePath, () => scheduleRestart(file));
          } catch {
            /* deleted before we could watch — next save re-triggers via restart */
          }
        }
      });
    }
  } catch (err) {
    console.warn(`[dev] cannot watch ${file}: ${String(err)}`);
  }
}

function shutdown(signal: string): void {
  stopped = true;
  if (debounce) clearTimeout(debounce);
  if (child) {
    child.kill(signal as NodeJS.Signals);
  }
  // Give the child a moment, then exit even if it hangs (dev-only).
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startChild();
