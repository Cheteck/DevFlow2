/**
 * @mosaix/command-center — MOSAIX // COMMAND CENTER public entry.
 *
 * TUI supervisor for development processes: ManagedProcess lifecycle,
 * .env watching, bounded event history, diagnostics and the cockpit
 * renderer. Dev-only tooling — never imported by production bundles.
 */
export * from "./supervisor-types.js";
export * from "./secret-guard.js";
export * from "./event-bus.js";
export * from "./process-manager.js";
export * from "./env-watcher.js";
export * from "./restart-tracker.js";
export * from "./diagnostics.js";
export * from "./theme.js";
export * from "./format.js";
export * from "./layout.js";
export * from "./palette.js";
export * from "./cockpit.js";
export * from "./renderer.js";
export * from "./terminal-renderer.js";
export * from "./supervisor.js";
