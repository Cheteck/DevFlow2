/**
 * @mosaix/dev-server — public entry. Re-exports the HMR DevServer (legacy
 * API, kept stable) and the new MOSAIX // COMMAND CENTER supervisor.
 */
export * from "./dev-server.js";
export * from "./command-center/supervisor-types.js";
export * from "./command-center/secret-guard.js";
export * from "./command-center/event-bus.js";
export * from "./command-center/process-manager.js";
export * from "./command-center/env-watcher.js";
export * from "./command-center/restart-tracker.js";
export * from "./command-center/diagnostics.js";
export * from "./command-center/renderer.js";
export * from "./command-center/terminal-renderer.js";
export * from "./command-center/supervisor.js";
