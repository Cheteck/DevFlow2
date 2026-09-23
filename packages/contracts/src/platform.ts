/**
 * Canonical Platform Primitive Contract (Phase 0.1)
 */

export interface PlatformConfig {
  id: string;
  name: string;
  version: string;
  environment: "development" | "staging" | "production" | "test";
  metadata?: Record<string, unknown>;
}

export interface PlatformInstance {
  readonly config: PlatformConfig;
  readonly startedAt: string;
  readonly status: "starting" | "active" | "degraded" | "stopping" | "stopped";
}
