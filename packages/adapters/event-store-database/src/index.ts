import { DatabasePort } from "@mosaix/ports-database";
import { EventStorePort, StoreEvent } from "@mosaix/ports-event-store";

/**
 * EventStoreDatabaseAdapter — Implémentation de EventStorePort utilisant DatabasePort.
 *
 * Schema attendu (migration correspondante requise dans l'app propriétaire) :
 *   CREATE TABLE event_store (
 *     id TEXT PRIMARY KEY,
 *     type TEXT NOT NULL,
 *     aggregate_type TEXT NOT NULL,
 *     aggregate_id TEXT NOT NULL,
 *     sequence INTEGER NOT NULL,
 *     payload TEXT NOT NULL,
 *     timestamp TEXT NOT NULL,
 *     metadata TEXT
 *   );
 *   CREATE INDEX idx_event_store_aggregate ON event_store(aggregate_type, aggregate_id);
 *   CREATE INDEX idx_event_store_type ON event_store(type);
 *
 * L'adaptateur garantit l'ordre des séquences par (aggregateType, aggregateId) via
 * expectedVersion (optimistic concurrency).
 */
export class EventStoreDatabaseAdapter implements EventStorePort {
  constructor(private readonly db: DatabasePort) {}

  async append(
    aggregateType: string,
    aggregateId: string,
    events: Omit<StoreEvent, "sequence">[],
    expectedVersion?: number,
  ): Promise<void> {
    if (events.length === 0) return;

    // Verify expected version if provided (optimistic concurrency)
    if (expectedVersion !== undefined) {
      const current = await this.readStream(aggregateType, aggregateId);
      if (current.length !== expectedVersion) {
        throw new Error(
          `Optimistic concurrency violation: expected version ${expectedVersion}, ` +
            `found ${current.length}`,
        );
      }
    }

    // Determine next sequence number
    const existing = await this.db.query<{ max_seq: number }>(
      `SELECT COALESCE(MAX(sequence), -1) as max_seq FROM event_store WHERE aggregate_type = ? AND aggregate_id = ?`,
      [aggregateType, aggregateId],
    );
    let sequence = (existing[0]?.max_seq ?? -1) + 1;

    // Batch insert all events
    for (const event of events) {
      await this.db.execute(
        `INSERT INTO event_store (id, type, aggregate_type, aggregate_id, sequence, payload, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.type,
          aggregateType,
          aggregateId,
          sequence++,
          JSON.stringify(event.payload),
          event.timestamp,
          event.metadata ? JSON.stringify(event.metadata) : null,
        ],
      );
    }
  }

  async readStream(aggregateType: string, aggregateId: string): Promise<StoreEvent[]> {
    const rows = await this.db.query<{
      id: string;
      type: string;
      aggregate_type: string;
      aggregate_id: string;
      sequence: number;
      payload: string;
      timestamp: string;
      metadata: string | null;
    }>(
      `SELECT id, type, aggregate_type, aggregate_id, sequence, payload, timestamp, metadata FROM event_store WHERE aggregate_type = ? AND aggregate_id = ? ORDER BY sequence ASC`,
      [aggregateType, aggregateId],
    );

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      sequence: row.sequence,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }
}