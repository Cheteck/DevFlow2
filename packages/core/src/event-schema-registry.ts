/**
 * Event Schema Registry — single owner per event type (roadmap §4.1).
 *
 * Validates that a published envelope is owned by its source application,
 * enforcing that every event has exactly one declared owner.
 */

import type { MosaixEventEnvelope } from "@mosaix/types";

/**
 * Minimal payload validator contract (roadmap §4.1: « payload validated against
 * registered schema »). Structural match for Zod schemas, so apps can register
 * either Zod schemas or hand-written validators. The framework never imports
 * Zod — it only calls `safeParse`.
 */
export interface PayloadValidator {
  safeParse(input: unknown): { success: boolean; error?: unknown };
}

export interface EventSchemaEntry {
  type: string;
  version: string;
  ownerApp: string;
  schema: Record<string, unknown>;
  /** Optional payload contract. When absent, payloads are not validated. */
  payloadSchema?: PayloadValidator;
}

export class EventSchemaRegistry {
  private readonly schemas = new Map<string, EventSchemaEntry>();

  register(entry: EventSchemaEntry): void {
    const key = `${entry.type}@${entry.version}`;
    const existing = this.schemas.get(key);
    if (existing && existing.ownerApp !== entry.ownerApp) {
      throw new Error(
        `Event schema ${key} already owned by ${existing.ownerApp} — ` +
          `single owner per event type (roadmap §4.1)`,
      );
    }
    this.schemas.set(key, entry);
  }

  get(type: string, version: string): EventSchemaEntry | undefined {
    return this.schemas.get(`${type}@${version}`);
  }

  /** Exact version registered? */
  isVersionRegistered(type: string, version: string): boolean {
    return this.get(type, version) !== undefined;
  }

  /**
   * Version negotiation (migration): returns every registered entry for the
   * event `type`. Consumers use it to tolerate forward/backward version
   * differences during migrations (roadmap §4.2).
   */
  getCompatible(type: string, version: string): EventSchemaEntry[] {
    const exact = this.get(type, version);
    const all = this.list().filter((s) => s.type === type);
    if (exact) {
      return all.filter((s) => s.version === version);
    }
    return all;
  }

  validateEnvelope(envelope: MosaixEventEnvelope): boolean {
    const schema = this.get(envelope.type, envelope.version);
    if (!schema) return false;
    return schema.ownerApp === envelope.source.application;
  }

  /**
   * Validate the payload against the registered contract (roadmap §4.1).
   * When no `payloadSchema` is registered for the event version, the payload
   * is accepted — preserving backward compatibility for events without a
   * declared payload contract.
   */
  validatePayload(envelope: MosaixEventEnvelope): boolean {
    const schema = this.get(envelope.type, envelope.version);
    if (!schema?.payloadSchema) return true;
    return schema.payloadSchema.safeParse(envelope.payload).success;
  }

  list(): EventSchemaEntry[] {
    return Array.from(this.schemas.values());
  }

  clear(): void {
    this.schemas.clear();
  }
}
