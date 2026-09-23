/**
 * Canonical Session Primitive Contract (Phase 0.1)
 */

export type DevSessionStatus = "initializing" | "active" | "rebuilding" | "stopped" | "failed";

export interface DevSession {
  readonly id: string;
  readonly projectId: string;
  readonly startedAt: string;
  readonly status: DevSessionStatus;
  readonly runtimeInfo: {
    readonly port: number;
    readonly pid: number;
  };
}
