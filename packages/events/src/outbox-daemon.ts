/**
 * @mosaix/events — Outbox Background Polling Daemon with Messaging Adapter Routing
 */

import type { OutboxWorker } from "./outbox-worker";

export interface MessagingPublisher {
  publish: (eventType: string, payload: unknown) => Promise<void>;
}

export interface OutboxDaemonOptions {
  pollIntervalMs?: number;
  maxRetries?: number;
  messagingPublisher?: MessagingPublisher;
  /** Called with background polling errors instead of silently swallowing them. */
  onError?: (err: unknown) => void;
  /** Random jitter added to each poll to avoid thundering herd (default 100ms). */
  pollJitterMs?: number;
}

export class OutboxDaemon {
  private worker: OutboxWorker;
  private pollIntervalMs: number;
  private messagingPublisher: MessagingPublisher | undefined = undefined;
  private onError: ((err: unknown) => void) | undefined;
  private pollJitterMs: number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private isRunning = false;

  constructor(worker: OutboxWorker, options: OutboxDaemonOptions = {}) {
    this.worker = worker;
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.messagingPublisher = options.messagingPublisher;
    this.onError = options.onError;
    this.pollJitterMs = options.pollJitterMs ?? 100;
  }

  start(customHandler?: (eventType: string, payload: unknown) => Promise<void>): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const handler = async (eventType: string, payload: unknown) => {
      if (this.messagingPublisher) {
        await this.messagingPublisher.publish(eventType, payload);
      }
      if (customHandler) {
        await customHandler(eventType, payload);
      }
    };

    this.timer = setInterval(async () => {
      try {
        await this.worker.processPendingEvents(handler);
      } catch (err) {
        if (this.onError) {
          try {
            this.onError(err);
          } catch {
            // Never let error hooks crash the daemon loop
          }
        } else {
          console.error("[OutboxDaemon] background poll failed:", err);
        }
      }
    }, this.pollIntervalMs + Math.floor(Math.random() * this.pollJitterMs));
    // Don't keep the process alive solely for background polling.
    if (typeof (this.timer as unknown as { unref?: () => void }).unref === "function") {
      (this.timer as unknown as { unref: () => void }).unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined as ReturnType<typeof setInterval> | undefined;
    }
    this.isRunning = false;
  }

  get active(): boolean {
    return this.isRunning;
  }
}
