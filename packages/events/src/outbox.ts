/**
 * @mosaix/events — Transactional Outbox Engine
 *
 * Persists domain events reliably using @mosaix/orm primitives for At-Least-Once delivery.
 */

import { Model, Repository } from "@mosaix/orm";
import type { DatabasePort } from "@mosaix/ports-database";

export class OutboxEventModel extends Model {
  static override tableName = "outbox_events";
  declare id: string;
  eventType!: string;
  payload!: string;
  status!: "PENDING" | "PROCESSED" | "FAILED";
  retryCount!: number;
}

export class TransactionalOutboxEngine {
  private repo: Repository<OutboxEventModel>;

  constructor(db: DatabasePort) {
    this.repo = new Repository(db, OutboxEventModel, "outbox_events");
  }

  async recordEvent(id: string, eventType: string, payload: unknown): Promise<OutboxEventModel> {
    return this.repo.create({
      id,
      eventType,
      payload: JSON.stringify(payload),
      status: "PENDING",
      retryCount: 0,
    });
  }

  async getPendingEvents(): Promise<OutboxEventModel[]> {
    return this.repo.findWhere({ status: "PENDING" });
  }

  async markAsProcessed(id: string): Promise<boolean> {
    return this.repo.update(id, { status: "PROCESSED" });
  }

  async markRetry(id: string, retryCount: number): Promise<boolean> {
    return this.repo.update(id, { retryCount });
  }

  async markAsFailed(id: string, retryCount: number): Promise<boolean> {
    return this.repo.update(id, { status: "FAILED", retryCount });
  }
}
