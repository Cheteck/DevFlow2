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

/**
 * EventStorePort — Decouples application event sourcing / append-only stores.
 */
export interface EventStorePort {
  /** Asynchronously appends events to a stream. */
  append(
    aggregateType: string,
    aggregateId: string,
    events: Omit<StoreEvent, "sequence">[],
    expectedVersion?: number,
  ): Promise<void>;
  /** Asynchronously retrieves events for an aggregate instance. */
  readStream(aggregateType: string, aggregateId: string): Promise<StoreEvent[]>;
}
