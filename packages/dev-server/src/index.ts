/**
 * @mosaix/dev-server — public entry. Re-exports the HMR DevServer (legacy
 * API, kept stable) and the MOSAIX // COMMAND CENTER cockpit.
 *
 * @deprecated (v0.2.0) For TUI supervision, import @mosaix/command-center directly.
 * This package will focus on HMR session management only in the next major.
 */
export * from "./dev-server.js";

// Re-export Command Center (transitional, will be removed in v0.2.0)
export * from "@mosaix/command-center";
