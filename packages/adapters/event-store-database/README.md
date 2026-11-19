# @mosaix/adapter-event-store-database

Database-backed implementation of `EventStorePort` (`@mosaix/ports-event-store`).

## Installation

```bash
pnpm add @mosaix/adapter-event-store-database @mosaix/ports-database @mosaix/ports-event-store
```

## Usage

```ts
import { DatabaseSync } from "node:sqlite";
import { EventStoreDatabaseAdapter } from "@mosaix/adapter-event-store-database";
import { DatabasePort } from "@mosaix/ports-database";

// Create a DatabasePort (example using node:sqlite)
const sqlite = new DatabaseSync("./data.db");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS event_store (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    payload TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    metadata TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_event_store_aggregate ON event_store(aggregate_type, aggregate_id);
`);

const db: DatabasePort = {
  execute: (sql, params) => sqlite.prepare(sql).run(...params).changes,
  query: (sql, params) => sqlite.prepare(sql).all(...params),
  transaction: async (fn) => fn(db), // simplified
};

const store = new EventStoreDatabaseAdapter(db);

// Append events with optimistic concurrency
await store.append("Order", "order-123", [
  { id: "evt-1", type: "OrderCreated", aggregateType: "Order", aggregateId: "order-123", payload: { total: 100 }, timestamp: new Date().toISOString() },
]);

// Read stream
const events = await store.readStream("Order", "order-123");
```

## Testing

```bash
pnpm vitest run packages/adapters/event-store-database
```

Tests run against an in-memory SQLite database (`node:sqlite`).