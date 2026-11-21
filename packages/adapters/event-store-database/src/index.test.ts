import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { EventStoreDatabaseAdapter } from "./index.js";
import { DatabasePort } from "@mosaix/ports-database";

/** Minimal in-test DatabasePort wrapping node:sqlite (same pattern as otp-database tests). */
function createTestDatabase(): DatabasePort {
  const sqlite = new DatabaseSync(":memory:");

  sqlite.exec(`
    CREATE TABLE event_store (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      payload TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );
    CREATE INDEX idx_event_store_aggregate ON event_store(aggregate_type, aggregate_id);
    CREATE INDEX idx_event_store_type ON event_store(type);
  `);

  return {
    execute: (sql: string, params: unknown[] = []) => {
      const stmt = sqlite.prepare(sql);
      const result = stmt.run(...params);
      return result.changes;
    },
    query: <T>(sql: string, params: unknown[] = []): T[] => {
      const stmt = sqlite.prepare(sql);
      return stmt.all(...params) as T[];
    },
    transaction: async <T>(fn: (port: DatabasePort) => Promise<T>): Promise<T> => {
      // node:sqlite doesn't have nested transactions easily; just run fn.
      return fn({
        execute: (sql, params) => {
          const stmt = sqlite.prepare(sql);
          return stmt.run(...params).changes;
        },
        query: <T>(sql, params) => {
          const stmt = sqlite.prepare(sql);
          return stmt.all(...params) as T[];
        },
        transaction: async (innerFn) => innerFn({
          execute: (sql, params) => {
            const stmt = sqlite.prepare(sql);
            return stmt.run(...params).changes;
          },
          query: <T>(sql, params) => {
            const stmt = sqlite.prepare(sql);
            return stmt.all(...params) as T[];
          },
          transaction: async () => { throw new Error("nested transaction not supported in test"); },
        }),
      });
    },
  };
}

describe("@mosaix/adapter-event-store-database", () => {
  let db: DatabasePort;
  let adapter: EventStoreDatabaseAdapter;

  beforeEach(() => {
    db = createTestDatabase();
    adapter = new EventStoreDatabaseAdapter(db);
  });

  const makeEvent = (overrides: Partial<{
    id: string;
    type: string;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
    timestamp: string;
    metadata: Record<string, unknown>;
  }> = {}) => ({
    id: overrides.id ?? `evt-${crypto.randomUUID()}`,
    type: overrides.type ?? "TestEvent",
    aggregateType: overrides.aggregateType ?? "TestAggregate",
    aggregateId: overrides.aggregateId ?? `agg-${crypto.randomUUID()}`,
    payload: overrides.payload ?? { foo: "bar" },
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    metadata: overrides.metadata,
  });

  it("appends and reads a single event", async () => {
    const evt = makeEvent();
    await adapter.append(evt.aggregateType, evt.aggregateId, [evt]);
    const stream = await adapter.readStream(evt.aggregateType, evt.aggregateId);
    expect(stream.length).toBe(1);
    expect(stream[0]).toMatchObject({
      id: evt.id,
      type: evt.type,
      aggregateType: evt.aggregateType,
      aggregateId: evt.aggregateId,
      payload: evt.payload,
      timestamp: evt.timestamp,
      sequence: 0,
    });
  });

  it("appends multiple events with incrementing sequences", async () => {
    const aggType = "Order";
    const aggId = "order-123";
    const evt1 = makeEvent({ type: "OrderCreated", aggregateType: aggType, aggregateId: aggId, sequence: undefined });
    const evt2 = makeEvent({ type: "OrderPaid", aggregateType: aggType, aggregateId: aggId, sequence: undefined });
    const evt3 = makeEvent({ type: "OrderShipped", aggregateType: aggType, aggregateId: aggId, sequence: undefined });

    await adapter.append(aggType, aggId, [evt1, evt2, evt3]);
    const stream = await adapter.readStream(aggType, aggId);
    expect(stream.length).toBe(3);
    expect(stream[0].sequence).toBe(0);
    expect(stream[1].sequence).toBe(1);
    expect(stream[2].sequence).toBe(2);
    expect(stream[0].type).toBe("OrderCreated");
    expect(stream[1].type).toBe("OrderPaid");
    expect(stream[2].type).toBe("OrderShipped");
  });

  it("enforces expectedVersion (optimistic concurrency)", async () => {
    const aggType = "Account";
    const aggId = "acc-456";
    const evt1 = makeEvent({ type: "AccountOpened", aggregateType: aggType, aggregateId: aggId });
    await adapter.append(aggType, aggId, [evt1]);

    // Correct version works
    const evt2 = makeEvent({ type: "DepositMade", aggregateType: aggType, aggregateId: aggId });
    await expect(adapter.append(aggType, aggId, [evt2], 1)).resolves.not.toThrow();

    // Wrong version throws
    const evt3 = makeEvent({ type: "WithdrawalMade", aggregateType: aggType, aggregateId: aggId });
    await expect(adapter.append(aggType, aggId, [evt3], 0)).rejects.toThrow(
      "Optimistic concurrency violation",
    );
  });

  it("returns empty array for unknown aggregate", async () => {
    const stream = await adapter.readStream("Unknown", "does-not-exist");
    expect(stream).toEqual([]);
  });

  it("handles metadata round-trip", async () => {
    const evt = makeEvent({ metadata: { correlationId: "corr-1", userId: "user-42" } });
    await adapter.append(evt.aggregateType, evt.aggregateId, [evt]);
    const stream = await adapter.readStream(evt.aggregateType, evt.aggregateId);
    expect(stream[0].metadata).toEqual({ correlationId: "corr-1", userId: "user-42" });
  });

  it("handles missing metadata (null in DB)", async () => {
    const evt = makeEvent({ metadata: undefined });
    await adapter.append(evt.aggregateType, evt.aggregateId, [evt]);
    const stream = await adapter.readStream(evt.aggregateType, evt.aggregateId);
    expect(stream[0].metadata).toBeUndefined();
  });

  it("persists across adapter instances (simulates restart)", async () => {
    const aggType = "Saga";
    const aggId = "saga-999";
    const evt1 = makeEvent({ type: "SagaStarted", aggregateType: aggType, aggregateId: aggId });
    await adapter.append(aggType, aggId, [evt1]);

    // New adapter instance on same DB
    const adapter2 = new EventStoreDatabaseAdapter(db);
    const evt2 = makeEvent({ type: "StepCompleted", aggregateType: aggType, aggregateId: aggId });
    await adapter2.append(aggType, aggId, [evt2]);

    const stream = await adapter2.readStream(aggType, aggId);
    expect(stream.length).toBe(2);
    expect(stream[0].type).toBe("SagaStarted");
    expect(stream[1].type).toBe("StepCompleted");
  });
});