import { describe, it, expect, vi } from "vitest";
import { DomainEventBus, EventStore, EventSchemaRegistry } from "@mosaix/core";
import type { MosaixEventEnvelope, TenantIdentity } from "@mosaix/contracts";
import type { Logger } from "@mosaix/core";

const TENANT: TenantIdentity = {
  organizationId: "acme-corp",
  spaceId: "retail-chain",
};

function envelope(type: string, payload: unknown): MosaixEventEnvelope {
  return {
    id: "evt-" + Math.random().toString(36).slice(2),
    type,
    version: "1.0.0",
    source: { application: "identity" },
    tenant: TENANT,
    timestamp: new Date().toISOString(),
    correlationId: "corr-1",
    payload,
    security: { classification: "internal" },
  };
}

function allowAll(): (p: string, t: TenantIdentity, a: string) => boolean {
  return () => true;
}

describe("core: EventStore — idempotency", () => {
  it("appends an event once and returns its sequence", () => {
    const store = new EventStore();
    const evt = envelope("identity.user.created", { u: 1 });
    const first = store.append(evt);
    const second = store.append(evt);
    expect(first).toBe(second);
    expect(store.query(TENANT)).toHaveLength(1);
  });

  it("does not duplicate a re-appended event by id", () => {
    const store = new EventStore();
    const a = envelope("identity.user.created", { u: 1 });
    const b = { ...envelope("identity.user.created", { u: 2 }), id: a.id };
    store.append(a);
    store.append(b);
    expect(store.query(TENANT)).toHaveLength(1);
    expect(store.query(TENANT)[0]!.envelope.payload).toEqual({ u: 1 });
    expect(store.has(a.id)).toBe(true);
  });
});

describe("core: DomainEventBus — retry & dead-letter", () => {
  it("moves a failing handler's event to the dead-letter queue", async () => {
    const bus = new DomainEventBus(new EventStore(), allowAll());
    const handler = vi.fn(async () => {
      throw new Error("handler boom");
    });
    bus.subscribe("order.created", handler, "sales");
    bus.setRetryPolicy("order.created", { retries: 1, backoffMs: 1 });

    await bus.publish(envelope("order.created", { o: 1 }), "identity");

    expect(handler).toHaveBeenCalledTimes(2); // initial + 1 retry
    const dead = bus.deadLetters();
    expect(dead).toHaveLength(1);
    expect(dead[0]!.subscriber).toBe("sales");
    expect(dead[0]!.attempts).toBe(2);
    expect(dead[0]!.error.message).toBe("handler boom");
  });

  it("flushDeadLetters clears the queue", async () => {
    const bus = new DomainEventBus(new EventStore(), allowAll());
    bus.subscribe(
      "order.created",
      async () => {
        throw new Error("boom");
      },
      "sales",
    );
    await bus.publish(envelope("order.created", { o: 1 }), "identity");
    expect(bus.deadLetters()).toHaveLength(1);
    bus.flushDeadLetters();
    expect(bus.deadLetters()).toHaveLength(0);
  });

  it("does not dead-letter when the handler succeeds", async () => {
    const bus = new DomainEventBus(new EventStore(), allowAll());
    bus.subscribe("order.created", () => undefined, "sales");
    await bus.publish(envelope("order.created", { o: 1 }), "identity");
    expect(bus.deadLetters()).toHaveLength(0);
    expect(bus.deadLetters()).toEqual([]);
  });

  it("propagates correlationId to subscribers on the same envelope", async () => {
    const bus = new DomainEventBus(new EventStore(), allowAll());
    const received: string[] = [];
    bus.subscribe(
      "order.created",
      (e) => received.push(e.correlationId),
      "sales",
    );
    const evt = envelope("order.created", { o: 1 });
    await bus.publish(evt, "identity");
    expect(received).toEqual([evt.correlationId]);
  });
});

describe("core: DomainEventBus — dead-letter logging", () => {
  function capturingLogger(): Logger & { warnings: Array<{ message: string; fields?: Record<string, unknown> }> } {
    const warnings: Array<{ message: string; fields?: Record<string, unknown> }> = [];
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn((message: string, fields?: Record<string, unknown>) => {
        warnings.push({ message, fields });
      }),
      error: vi.fn(),
      child: vi.fn(() => capturingLogger()),
      warnings,
    };
  }

  it("logs a structured warn when a handler fails after all retries", async () => {
    const logger = capturingLogger();
    const bus = new DomainEventBus(new EventStore(), allowAll(), undefined, undefined, logger);
    const handler = vi.fn(async () => {
      throw new Error("handler boom");
    });
    bus.subscribe("order.created", handler, "sales");
    bus.setRetryPolicy("order.created", { retries: 1, backoffMs: 1 });

    await bus.publish(envelope("order.created", { o: 1 }), "identity");

    expect(handler).toHaveBeenCalledTimes(2); // initial + 1 retry
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const call = logger.warn.mock.calls[0];
    expect(call[0]).toBe("Event moved to dead-letter queue");
    const fields = call[1];
    expect(fields.eventId).toBeDefined();
    expect(fields.subscriber).toBe("sales");
    expect(fields.error).toBe("handler boom");
    expect(fields.attempts).toBe(2); // 1 tentative + 1 retry
    expect(fields.failedAt).toBeDefined();
    expect(bus.deadLetters()).toHaveLength(1);
  });

  it("logs a structured warn with retries:0 after the initial attempt fails", async () => {
    const logger = capturingLogger();
    const bus = new DomainEventBus(new EventStore(), allowAll(), undefined, undefined, logger);
    const handler = vi.fn(async () => {
      throw new Error("initial failure");
    });
    bus.subscribe("order.created", handler, "sales");
    // pas de setRetryPolicy => default { retries: 0 }

    await bus.publish(envelope("order.created", { o: 1 }), "identity");

    expect(handler).toHaveBeenCalledTimes(1); // tentative initiale uniquement
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const fields = logger.warn.mock.calls[0][1];
    expect(fields.attempts).toBe(1); // une seule tentative, aucun retry
    expect(fields.error).toBe("initial failure");
    expect(bus.deadLetters()).toHaveLength(1);
  });

  it("does not log when the handler succeeds", async () => {
    const logger = capturingLogger();
    const bus = new DomainEventBus(new EventStore(), allowAll(), undefined, undefined, logger);
    bus.subscribe("order.created", async () => undefined, "sales");
    bus.setRetryPolicy("order.created", { retries: 3, backoffMs: 1 });

    await bus.publish(envelope("order.created", { o: 1 }), "identity");

    expect(logger.warn).not.toHaveBeenCalled();
    expect(bus.deadLetters()).toHaveLength(0);
  });

  it("uses a default logger when none is injected (production guarantee)", async () => {
    const bus = new DomainEventBus(new EventStore(), allowAll());
    const handler = vi.fn(async () => {
      throw new Error("no logger injected");
    });
    bus.subscribe("order.created", handler, "sales");
    bus.setRetryPolicy("order.created", { retries: 0, backoffMs: 1 });

    // Ne doit pas lever d'erreur et doit placer l'événement en DLQ
    await bus.publish(envelope("order.created", { o: 1 }), "identity");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.deadLetters()).toHaveLength(1);
  });
});

describe("core: EventSchemaRegistry — version negotiation", () => {
  it("returns exact version entries when the version is registered", () => {
    const registry = new EventSchemaRegistry();
    registry.register({
      type: "order.created",
      version: "1.0.0",
      ownerApp: "sales",
      schema: {},
    });
    registry.register({
      type: "order.created",
      version: "2.0.0",
      ownerApp: "sales",
      schema: {},
    });
    expect(registry.getCompatible("order.created", "2.0.0")).toHaveLength(1);
    expect(registry.isVersionRegistered("order.created", "2.0.0")).toBe(true);
  });

  it("returns all versions for forward tolerance when version is unknown", () => {
    const registry = new EventSchemaRegistry();
    registry.register({
      type: "order.created",
      version: "1.0.0",
      ownerApp: "sales",
      schema: {},
    });
    expect(registry.getCompatible("order.created", "9.9.9")).toHaveLength(1);
    expect(registry.isVersionRegistered("order.created", "9.9.9")).toBe(false);
  });
});

describe("core: EventSchemaRegistry — payload contracts", () => {
  const validPayload = { user: { id: "u-1", email: "ada@example.com" } };
  const invalidPayload = { user: "not-an-object" };

  function envelopeWith(payload: unknown): MosaixEventEnvelope {
    return { ...envelope("identity.user.created", payload) };
  }

  it("accepts a payload matching the registered contract", () => {
    const registry = new EventSchemaRegistry();
    registry.register({
      type: "identity.user.created",
      version: "1.0.0",
      ownerApp: "identity",
      schema: {},
      payloadSchema: {
        safeParse: (input) =>
          (input as { user?: unknown }).user !== undefined
            ? { success: true }
            : { success: false },
      },
    });

    expect(registry.validatePayload(envelopeWith(validPayload))).toBe(true);
  });

  it("rejects a payload violating the registered contract", () => {
    const registry = new EventSchemaRegistry();
    registry.register({
      type: "identity.user.created",
      version: "1.0.0",
      ownerApp: "identity",
      schema: {},
      payloadSchema: {
        safeParse: (input) =>
          (input as { user?: unknown }).user !== undefined &&
          typeof (input as { user: unknown }).user === "object"
            ? { success: true }
            : { success: false },
      },
    });

    expect(registry.validatePayload(envelopeWith(invalidPayload))).toBe(false);
  });

  it("tolerates events without a registered payload contract", () => {
    const registry = new EventSchemaRegistry();
    registry.register({
      type: "identity.user.created",
      version: "1.0.0",
      ownerApp: "identity",
      schema: {},
    });

    expect(registry.validatePayload(envelopeWith(invalidPayload))).toBe(true);
  });
});

describe("core: DomainEventBus — payload validation at publish", () => {
  function busWithPayloadCheck(
    payloadCheck: (envelope: MosaixEventEnvelope) => boolean,
  ): DomainEventBus {
    return new DomainEventBus(
      new EventStore(),
      allowAll(),
      undefined,
      payloadCheck,
    );
  }

  it("rejects a payload that fails its contract", async () => {
    const bus = busWithPayloadCheck(
      (env) => (env.payload as { user?: unknown }).user !== undefined,
    );

    await expect(
      bus.publish(envelope("identity.user.created", { bad: true }), "identity"),
    ).rejects.toThrow(/Payload validation failed/);
  });

  it("accepts a payload matching its contract", async () => {
    const bus = busWithPayloadCheck(() => true);

    await expect(
      bus.publish(envelope("identity.user.created", { user: {} }), "identity"),
    ).resolves.toBeUndefined();
  });

  it("keeps current behavior when no payload check is provided", async () => {
    const bus = new DomainEventBus(new EventStore(), allowAll());

    await expect(
      bus.publish(
        envelope("identity.user.created", { anything: true }),
        "identity",
      ),
    ).resolves.toBeUndefined();
  });
});
