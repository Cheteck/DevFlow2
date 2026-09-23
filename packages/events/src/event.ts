/**
 * @mosaix/events — Typed Event Base Class
 */

export abstract class MosaixEvent<TPayload = unknown> {
  abstract readonly eventType: string;
  abstract readonly version: string;
  readonly timestamp: string;

  constructor(public readonly payload: TPayload) {
    this.timestamp = new Date().toISOString();
  }
}
