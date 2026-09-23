import { featureAsync } from "@mosaix/sdk";

export interface DLQItem {
  id: string;
  eventName: string;
  payload: Record<string, unknown>;
  failedAt: string;
  retryCount: number;
  lastError: string;
}

export interface CircuitBreakerStatus {
  name: string;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  lastFailureAt?: string;
}

export interface DLQRepository {
  saveDLQItem(item: {
    id?: string;
    topic: string;
    payload?: unknown;
    errorMessage: string;
    failedAt?: Date;
  }): Promise<void>;
  getDLQItems(limit?: number): Promise<Array<{
    id: string;
    topic: string;
    payload?: unknown;
    errorMessage: string;
    failedAt: string;
  }>>;
  deleteDLQItem(id: string): Promise<void>;
  saveCircuitBreaker(entry: {
    name: string;
    state: "open" | "half_open" | "closed";
    failures?: number;
    lastFailureAt?: Date;
  }): Promise<void>;
  getCircuitBreakers(): Promise<Array<{
    name: string;
    state: "open" | "half_open" | "closed";
    failures: number;
    lastFailureAt: string;
  }>>;
}

export type EventRedispatcher = (topic: string, payload: unknown) => Promise<void> | void;

export class ControlPlaneSupervisorService {
  private dlqItems = new Map<string, DLQItem>();
  private circuitBreakers = new Map<string, CircuitBreakerStatus>();
  private repo?: DLQRepository;
  private redispatcher?: EventRedispatcher;

  constructor(repo?: DLQRepository, redispatcher?: EventRedispatcher) {
    this.repo = repo;
    this.redispatcher = redispatcher;
    this.initDefaultState();
  }

  setRedispatcher(redispatcher: EventRedispatcher): void {
    this.redispatcher = redispatcher;
  }

  private async initDefaultState(): Promise<void> {
    this.dlqItems.set("dlq-1", {
      id: "dlq-1",
      eventName: "order.checkout.failed",
      payload: { orderId: "ord-99" },
      failedAt: new Date().toISOString(),
      retryCount: 3,
      lastError: "Payment gateway timeout",
    });

    this.circuitBreakers.set("payment-gateway", {
      name: "payment-gateway",
      state: "OPEN",
      failureCount: 5,
      lastFailureAt: new Date().toISOString(),
    });

    if (this.repo) {
      try {
        const persistedDLQ = await this.repo.getDLQItems();
        if (persistedDLQ.length > 0) {
          this.dlqItems.clear();
          for (const item of persistedDLQ) {
            this.dlqItems.set(item.id, {
              id: item.id,
              eventName: item.topic,
              payload: (item.payload as Record<string, unknown>) || {},
              failedAt: item.failedAt,
              retryCount: 1,
              lastError: item.errorMessage,
            });
          }
        }

        const persistedCB = await this.repo.getCircuitBreakers();
        if (persistedCB.length > 0) {
          this.circuitBreakers.clear();
          for (const cb of persistedCB) {
            this.circuitBreakers.set(cb.name, {
              name: cb.name,
              state: cb.state.toUpperCase() as "CLOSED" | "OPEN" | "HALF_OPEN",
              failureCount: cb.failures,
              lastFailureAt: cb.lastFailureAt,
            });
          }
        }
      } catch (err) {
        console.warn("[imperia:supervisor] Failed to preload persisted DLQ/CircuitBreakers:", err);
      }
    }
  }

  async recordDLQFailure(item: Omit<DLQItem, "id" | "failedAt" | "retryCount"> & { id?: string }): Promise<DLQItem> {
    const id = item.id || `dlq-${Date.now()}`;
    const failedAt = new Date().toISOString();
    const entry: DLQItem = {
      id,
      eventName: item.eventName,
      payload: item.payload,
      failedAt,
      retryCount: 1,
      lastError: item.lastError,
    };
    this.dlqItems.set(id, entry);

    if (this.repo) {
      await this.repo.saveDLQItem({
        id,
        topic: item.eventName,
        payload: item.payload,
        errorMessage: item.lastError,
        failedAt: new Date(failedAt),
      });
    }

    return entry;
  }

  listDLQItems(): DLQItem[] {
    return Array.from(this.dlqItems.values());
  }

  getDLQItems(): DLQItem[] {
    return this.listDLQItems();
  }

  async replayDLQItem(id: string): Promise<boolean> {
    const autoReplayEnabled = await featureAsync("imperia.dlq.auto_replay", false);
    const item = this.dlqItems.get(id);
    if (!item) return false;

    if (autoReplayEnabled || item.retryCount < 5) {
      // Real redispatch of event onto message bus
      if (this.redispatcher) {
        try {
          await this.redispatcher(item.eventName, item.payload);
        } catch (err) {
          console.error(`[imperia:supervisor] Error while redispatching DLQ event ${item.eventName}:`, err);
          return false;
        }
      }

      this.dlqItems.delete(id);
      if (this.repo) {
        await this.repo.deleteDLQItem(id);
      }
      return true;
    }
    return false;
  }

  listCircuitBreakers(): CircuitBreakerStatus[] {
    return Array.from(this.circuitBreakers.values());
  }

  getCircuitBreakers(): CircuitBreakerStatus[] {
    return this.listCircuitBreakers();
  }

  async resetCircuitBreaker(name: string): Promise<boolean> {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return false;
    cb.state = "CLOSED";
    cb.failureCount = 0;

    if (this.repo) {
      await this.repo.saveCircuitBreaker({
        name,
        state: "closed",
        failures: 0,
        lastFailureAt: new Date(),
      });
    }

    return true;
  }
}
