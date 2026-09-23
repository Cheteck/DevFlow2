/**
 * Canonical Runtime Primitive Contract (Phase 0.1)
 */

export type RuntimeKernelState =
  | "CREATED"
  | "INITIALIZING"
  | "READY"
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "FAILED";

export interface RuntimeKernelInfo {
  readonly id: string;
  readonly state: RuntimeKernelState;
  readonly uptimeMs: number;
  readonly modules: readonly string[];
}
