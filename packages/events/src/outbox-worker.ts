/**
 * @mosaix/events — Asynchronous Outbox Worker & Dead Letter Queue (DLQ) with Replay Engine
 */

import type { TransactionalOutboxEngine, OutboxEventModel } from "./outbox";

export class DeadLetterQueue {
  private dlqEvents: OutboxEventModel[] = [];

  enqueue(event: OutboxEventModel, _reason: string): void {
    if (!this.dlqEvents.some((e) => e.id === event.id)) {
      this.dlqEvents.push(event);
    }
  }

  getFailedEvents(): ReadonlyArray<OutboxEventModel> {
    return this.dlqEvents;
  }

  remove(id: string): void {
    this.dlqEvents = this.dlqEvents.filter((e) => e.id !== id);
  }

  clear(): void {
    this.dlqEvents = [];
  }
}

export interface OutboxWorkerOptions {
  maxRetries?: number;
  /** Per-event handler timeout in ms (default 10000). Prevents a stuck handler from blocking the queue. */
  handlerTimeoutMs?: number;
}

export class OutboxWorker {
  private engine: TransactionalOutboxEngine;
  readonly dlq = new DeadLetterQueue();
  private maxRetries: number;
  private handlerTimeoutMs: number;
  private readonly processedIds = new Set<string>();

  constructor(engine: TransactionalOutboxEngine, maxRetriesOrOptions: number | OutboxWorkerOptions = 3) {
    this.engine = engine;
    if (typeof maxRetriesOrOptions === "number") {
      this.maxRetries = maxRetriesOrOptions;
      this.handlerTimeoutMs = 10000;
    } else {
      this.maxRetries = maxRetriesOrOptions.maxRetries ?? 3;
      this.handlerTimeoutMs = maxRetriesOrOptions.handlerTimeoutMs ?? 10000;
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Outbox handler timed out after ${this.handlerTimeoutMs}ms`)), this.handlerTimeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    }) as Promise<T>;
  }

  async processPendingEvents(
    handler: (eventType: string, payload: unknown) => Promise<void>
  ): Promise<{ processed: number; failed: number }> {
    const pending = await this.engine.getPendingEvents();
    let processed = 0;
    let failed = 0;

    for (const event of pending) {
      // Idempotence guard: skip events already processed in this worker lifetime
      // (at-least-once delivery may redeliver after markAsProcessed race).
      if (this.processedIds.has(event.id)) {
        continue;
      }
      try {
        const payload = JSON.parse(event.payload);
        await this.withTimeout(handler(event.eventType, payload));
        await this.engine.markAsProcessed(event.id);
        this.processedIds.add(event.id);
        processed++;
      } catch (err) {
        failed++;
        const newRetryCount = (event.retryCount ?? 0) + 1;
        event.retryCount = newRetryCount;

        try {
          await this.engine.markRetry(event.id, newRetryCount);
        } catch {
          // Ignore DB update error during fail handler
        }

        if (newRetryCount >= this.maxRetries) {
          try {
            await this.engine.markAsFailed(event.id, newRetryCount);
          } catch {
            // Ignore DB update error
          }
          this.dlq.enqueue(event, err instanceof Error ? err.message : String(err));
        } else {
          // Exponential backoff hint: persist retryCount so a future
          // poll can delay; simplest generic approach without a scheduler.
          await new Promise((r) => setTimeout(r, Math.min(100 * 2 ** (newRetryCount - 1), 2000)));
        }
      }
    }

    // Bound memory of idempotence set.
    if (this.processedIds.size > 10000) {
      const overflow = this.processedIds.size - 10000;
      const it = this.processedIds.values();
      for (let i = 0; i < overflow; i++) {
        const v = it.next().value;
        if (v !== undefined) this.processedIds.delete(v);
      }
    }

    return { processed, failed };
  }

  async replayFailedEvents(
    handler: (eventType: string, payload: unknown) => Promise<void>
  ): Promise<{ replayed: number; remainingFailed: number }> {
    const failedEvents = [...this.dlq.getFailedEvents()];
    let replayed = 0;

    for (const event of failedEvents) {
      try {
        const payload = JSON.parse(event.payload);
        await handler(event.eventType, payload);
        await this.engine.markAsProcessed(event.id);
        this.dlq.remove(event.id);
        replayed++;
      } catch {
        // Keeps event in DLQ if replay fails again
      }
    }

    return { replayed, remainingFailed: this.dlq.getFailedEvents().length };
  }
}
