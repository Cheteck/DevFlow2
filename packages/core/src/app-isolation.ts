/**
 * Application Execution Isolation Manager (Phase 8)
 */

export type ExecutionMode = "shared" | "worker" | "process";

export interface IsolationConfig {
  readonly mode: ExecutionMode;
  readonly maxMemoryMb?: number;
}

export class AppIsolationManager {
  static resolveMode(isolation: "sandbox" | "trusted", engine?: "web-worker" | "iframe" | "wasm"): ExecutionMode {
    if (isolation === "sandbox") {
      return engine === "web-worker" ? "worker" : "process";
    }
    return "shared";
  }
}
