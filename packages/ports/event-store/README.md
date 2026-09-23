# @mosaix/ports-event-store

Event store port for the MosaiX platform. Decouples event sourcing / append-only stores from the storage backend.

## Structure

This port models **durable event persistence for domain / event-sourcing stores**:
append-by-aggregate with an optional `expectedVersion` (optimistic concurrency)
and per-aggregate `readStream`.

It is **distinct from the Runtime Kernel's in-memory `EventStore`
(`packages/core/src/event-bus.ts`)**, which is the kernel's internal
tenant-scoped, in-memory journal for the `DomainEventBus` (idempotent by
`envelope.id`, no aggregate sequencing). The two abstractions are intentionally
separated by the dependency boundary: `adapters` (and `ports`) may not import
`@mosaix/core`, and `@mosaix/core` depends only on
`contracts`/`schemas`/`types` (see `eslint.config.mjs:73-83,95-97`).

> Decision & intended wiring path: `.project/architecture/event-store-duality.md`
> (T-EXT-12). The port is a **target of T-EXT-05** (adapter composition in the
> runtime kernel) — an adapter implementing this contract will be wired there
> without touching the kernel's default in-memory store.

## Exports

```typescript
export interface StoreEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  sequence: number;
  payload: unknown;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface EventStorePort {
  append(
    aggregateType: string,
    aggregateId: string,
    events: Omit<StoreEvent, "sequence">[],
    expectedVersion?: number,
  ): Promise<void>;
  readStream(aggregateType: string, aggregateId: string): Promise<StoreEvent[]>;
}
```

## Notes

- `append` sequences events automatically. Pass `expectedVersion` to implement optimistic concurrency (the store should reject a write if the stream has moved beyond it).

## Usage

```typescript
import type { EventStorePort, StoreEvent } from "@mosaix/ports-event-store";

class MyService {
  constructor(private readonly store: EventStorePort) {}

  async record(id: string, event: Omit<StoreEvent, "sequence">) {
    await this.store.append("User", id, [event]);
  }

  async load(id: string) {
    return await this.store.readStream("User", id);
  }
}
```

## Adapters

None yet.

The Runtime Kernel's in-memory event store is **not** an adapter for this port:
it cannot be adapted without violating the dependency boundary (see
`.project/architecture/event-store-duality.md`). The port is queued as a target
of T-EXT-05 (adapter composition) — see the `Structure` section above.
