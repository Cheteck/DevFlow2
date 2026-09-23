/**
 * @mosaix/core
 * Runtime Kernel for Composable Application Ecosystems.
 *
 * Depends on: @mosaix/types (downward dependency only)
 * Consumed by: @mosaix/sdk, apps/*
 */

import type {
  MosaixEventEnvelope,
  PermissionString,
  TenantIdentity,
} from "@mosaix/types";
import { EventError } from "./kernel-errors";

// ─── Event Store (tenant-scoped, in-memory) ────────────────────

export interface EventStoreEntry {
  envelope: MosaixEventEnvelope;
  storedAt: string;
  sequence: number;
}

export function normalizeTenant(tenant?: TenantIdentity | string): TenantIdentity {
  if (!tenant) return { organizationId: "default" };
  if (typeof tenant === "string") return { organizationId: tenant };
  return tenant;
}

/**
 * Tenant-scoped, in-memory append-only journal used by the kernel's internal
 * `DomainEventBus`. Distinct from the domain-level `EventStorePort`
 * (`@mosaix/ports-event-store`, aggregate + expectedVersion) — the two are
 * intentionally separated by the dependency boundary.
 * @see .project/architecture/event-store-duality.md — T-EXT-12 decision
 */
export class EventStore {
  private readonly stores = new Map<string, EventStoreEntry[]>();

  private tenantKey(tenant?: TenantIdentity | string): string {
    const t = normalizeTenant(tenant);
    return t.spaceId
      ? `${t.organizationId}:${t.spaceId}`
      : t.organizationId || "default";
  }

  /**
   * Append an event to its tenant's store. Idempotent by `envelope.id`:
   * re-appending an already stored event returns its existing sequence and
   * does not duplicate it.
   */
  append(envelope: MosaixEventEnvelope): number {
    const key = this.tenantKey(envelope.tenant);
    const store = this.stores.get(key) ?? [];
    const existing = store.find((e) => e.envelope.id === envelope.id);
    if (existing) return existing.sequence;
    const sequence = store.length;
    store.push({ envelope, storedAt: envelope.timestamp, sequence });
    this.stores.set(key, store);
    return sequence;
  }

  query(tenant?: TenantIdentity | string, type?: string): EventStoreEntry[] {
    const key = this.tenantKey(tenant);
    const store = this.stores.get(key) ?? [];
    return type ? store.filter((e) => e.envelope.type === type) : store;
  }

  has(id: string): boolean {
    for (const store of this.stores.values()) {
      if (store.some((e) => e.envelope.id === id)) return true;
    }
    return false;
  }

  clear(tenant?: TenantIdentity | string): void {
    this.stores.delete(this.tenantKey(tenant));
  }
}

// ─── Event Bus (Domain events) ─────────────────────────────────

export type EventHandler = (event: MosaixEventEnvelope) => Promise<void> | void;

export interface Subscription {
  handler: EventHandler;
  subscriber: string;
}

export interface RetryPolicy {
  retries: number;
  backoffMs?: number;
}

export interface DeadLetterEntry {
  event: MosaixEventEnvelope;
  subscriber: string;
  error: Error;
  attempts: number;
  failedAt: string;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DomainEventBus {
  private readonly handlers = new Map<string, Set<Subscription>>();
  private readonly store: EventStore;
  private readonly permissionCheck: (
    permission: PermissionString,
    tenant: TenantIdentity,
    app: string,
  ) => boolean;
  private readonly schemaCheck:
    ((envelope: MosaixEventEnvelope) => boolean) | undefined;
  private readonly payloadCheck:
    ((envelope: MosaixEventEnvelope) => boolean) | undefined;
  private readonly retryPolicies = new Map<string, RetryPolicy>();
  private deadLetterQueue: DeadLetterEntry[] = [];

  constructor(
    store: EventStore,
    permissionCheck: (
      permission: PermissionString,
      tenant: TenantIdentity,
      app: string,
    ) => boolean,
    schemaCheck?: (envelope: MosaixEventEnvelope) => boolean,
    payloadCheck?: (envelope: MosaixEventEnvelope) => boolean,
  ) {
    this.store = store;
    this.permissionCheck = permissionCheck;
    this.schemaCheck = schemaCheck;
    this.payloadCheck = payloadCheck;
  }

  subscribe(
    type: string,
    handler: EventHandler,
    subscriber: string,
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const subscription: Subscription = { handler, subscriber };
    set.add(subscription);
    return () => {
      set!.delete(subscription);
    };
  }

  setRetryPolicy(type: string, policy: RetryPolicy): void {
    this.retryPolicies.set(type, policy);
  }

  deadLetters(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  flushDeadLetters(): void {
    this.deadLetterQueue = [];
  }

  async publish(
    envelope: MosaixEventEnvelope,
    publisher: string,
  ): Promise<void> {
    if (this.schemaCheck && !this.schemaCheck(envelope)) {
      throw new EventError(
        `Schema validation failed: ${envelope.type}@${envelope.version} is not a registered/owned event`,
        { type: envelope.type, version: envelope.version, publisher },
      );
    }

    if (this.payloadCheck && !this.payloadCheck(envelope)) {
      throw new EventError(
        `Payload validation failed: ${envelope.type}@${envelope.version} does not match its registered payload contract`,
        { type: envelope.type, version: envelope.version, publisher },
      );
    }

    // Scope is exact-match in the permission grammar (no wildcard on scope).
    const tenant = normalizeTenant(envelope.tenant);
    const publishPerm =
      `*:${envelope.type}:publish:tenant` as PermissionString;
    if (!this.permissionCheck(publishPerm, tenant, publisher)) {
      throw new EventError(
        `Permission denied: ${publisher} cannot publish ${envelope.type}`,
        { type: envelope.type, publisher },
      );
    }

    this.store.append(envelope);

    const subscriptions = this.handlers.get(envelope.type);
    if (!subscriptions) return;

    for (const { handler, subscriber } of subscriptions) {
      const consumePerm =
        `*:${envelope.type}:consume:tenant` as PermissionString;
      if (!this.permissionCheck(consumePerm, tenant, subscriber)) {
        continue;
      }
      await this.deliver(handler, subscriber, envelope);
    }
  }

  private async deliver(
    handler: EventHandler,
    subscriber: string,
    envelope: MosaixEventEnvelope,
  ): Promise<void> {
    const policy = this.retryPolicies.get(envelope.type) ?? { retries: 0 };
    const backoff = policy.backoffMs ?? 0;
    let lastError: unknown;

    for (let attempt = 0; attempt <= policy.retries; attempt++) {
      try {
        await handler(envelope);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < policy.retries) {
          await sleep(backoff * 2 ** attempt);
        }
      }
    }

    this.deadLetterQueue.push({
      event: envelope,
      subscriber,
      error: toError(lastError),
      attempts: policy.retries + 1,
      failedAt: new Date().toISOString(),
    });
  }
}

export { DomainEventBus as MosaixEventBus };
