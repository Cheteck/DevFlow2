/**
 * @mosaix/core — Application Lifecycle (state machine)
 *
 * Strict transition automaton for the app lifecycle. The default flow stays
 * backward-compatible:
 *
 *   discovered → initializing → active
 *   initializing → degraded     active → degraded → disabled
 *   discovered → degraded       degraded → initializing (retry)
 *
 * The full state space (ADR-0002 / roadmap) additionally supports:
 *   discovered → registered → ready → active
 *   active → draining → disabled      (graceful shutdown)
 *   initializing → failed → initializing (retry)
 *
 * Invalid transitions throw `LifecycleError`, so the runtime can never reach
 * an incoherent state.
 */

import type { AppStatus } from "@mosaix/types";

import { LifecycleError } from "./kernel-errors";

export interface LifecycleCallbacks {
  onInitializing?: () => Promise<void> | void;
  onActive?: () => Promise<void> | void;
  onDegraded?: (error: unknown) => Promise<void> | void;
  onDisabled?: () => Promise<void> | void;
  onReady?: () => Promise<void> | void;
  onDraining?: () => Promise<void> | void;
}

export interface LifecycleObserver {
  onStateChange?: (status: AppStatus) => void;
}

export interface LifecycleEvent {
  from: AppStatus;
  to: AppStatus;
  timestamp: number;
}

const TRANSITIONS: Record<AppStatus, readonly AppStatus[]> = {
  discovered: ["registered", "initializing", "degraded", "failed"],
  registered: ["ready", "initializing", "degraded"],
  initializing: ["ready", "active", "degraded", "failed"],
  ready: ["initializing", "active", "degraded", "disabled"],
  active: ["degraded", "disabled", "draining"],
  degraded: ["initializing", "ready", "disabled", "failed"],
  draining: ["disabled", "degraded"],
  disabled: [],
  failed: ["initializing"],
};

export class AppLifecycle {
  private currentStatus: AppStatus = "discovered";
  private readonly callbacks: LifecycleCallbacks;
  private readonly observer: LifecycleObserver;
  private readonly history: LifecycleEvent[] = [];

  constructor(
    callbacks: LifecycleCallbacks = {},
    observer: LifecycleObserver = {},
  ) {
    this.callbacks = callbacks;
    this.observer = observer;
  }

  get status(): AppStatus {
    return this.currentStatus;
  }

  /** Health: an app is degraded/failed → unhealthy, everything else healthy. */
  get isHealthy(): boolean {
    return this.currentStatus !== "degraded" && this.currentStatus !== "failed";
  }

  /** Readiness: only ready/active states accept work. */
  get isReady(): boolean {
    return this.currentStatus === "ready" || this.currentStatus === "active";
  }

  /** Read-only history of every lifecycle transition (for auditing). */
  events(): LifecycleEvent[] {
    return [...this.history];
  }

  private transition(to: AppStatus): void {
    const allowed = TRANSITIONS[this.currentStatus];
    if (!allowed.includes(to)) {
      throw new LifecycleError(
        `Invalid lifecycle transition: ${this.currentStatus} → ${to}`,
        { from: this.currentStatus, to },
      );
    }
    const from = this.currentStatus;
    this.currentStatus = to;
    this.history.push({ from, to, timestamp: Date.now() });
    this.observer.onStateChange?.(to);
  }

  async initialize(): Promise<void> {
    this.transition("initializing");
    try {
      await this.callbacks.onInitializing?.();
      this.transition("active");
      await this.callbacks.onActive?.();
    } catch (error) {
      // A failure mid-initialization moves the app to `degraded`, never
      // leaving it stuck in `initializing`.
      this.transition("degraded");
      await this.callbacks.onDegraded?.(error);
      throw error;
    }
  }

  /** discovered → registered (declared but not yet ready). */
  markRegistered(): void {
    this.transition("registered");
  }

  /** registered → ready (dependencies satisfied, health checks passed). */
  async markReady(): Promise<void> {
    this.transition("ready");
    await this.callbacks.onReady?.();
  }

  /** degraded/failed → initializing → active (controlled retry). */
  async retry(): Promise<void> {
    if (this.currentStatus !== "degraded" && this.currentStatus !== "failed") {
      throw new LifecycleError(
        `Invalid lifecycle transition: ${this.currentStatus} → initializing (retry allowed from degraded/failed)`,
        { from: this.currentStatus, to: "initializing" },
      );
    }
    await this.initialize();
  }

  /** active → draining → disabled (graceful shutdown). */
  async drain(): Promise<void> {
    this.transition("draining");
    await this.callbacks.onDraining?.();
    this.transition("disabled");
    await this.callbacks.onDisabled?.();
  }

  async degrade(error: unknown): Promise<void> {
    this.transition("degraded");
    await this.callbacks.onDegraded?.(error);
  }

  async disable(): Promise<void> {
    this.transition("disabled");
    await this.callbacks.onDisabled?.();
  }
}
