import { describe, it, expect, beforeEach } from "vitest";
import { RuntimeKernel } from "@mosaix/core";
import { DomainEventBus, EventStore } from "@mosaix/core";
import { PermissionRegistry } from "@mosaix/core";
import type {
  ApplicationManifest,
  MosaixEventEnvelope,
  TenantIdentity,
} from "@mosaix/contracts";

const TENANT: TenantIdentity = {
  organizationId: "acme-corp",
  spaceId: "retail-chain",
};

function manifest(id: string, events?: string[]): ApplicationManifest {
  return {
    type: "application",
    id,
    name: id,
    version: "1.0.0",
    metadata: { name: id },
    domain: { entities: [], events: events ?? [] },
    runtime: {
      entrypoint: `/${id}.js`,
      isolation: "sandbox",
      engine: "web-worker",
    },
  };
}

function capability(
  id: string,
  ownerApp: string,
): ApplicationManifest["capabilities"] extends Array<infer E> ? E : never {
  return {
    id,
    version: "1.0.0",
    provider: { applicationId: ownerApp },
    operations: [{ name: "invoke", input: "in", output: "out" }],
  };
}

function envelope(type: string, payload: unknown): MosaixEventEnvelope {
  return {
    id: "evt-" + Date.now(),
    type,
    version: "1.0.0",
    source: { application: "identity" },
    tenant: TENANT,
    timestamp: new Date().toISOString(),
    correlationId: "corr-" + Date.now(),
    payload,
    security: { classification: "internal" },
  };
}

function validator(shape: Record<string, string>) {
  return {
    safeParse(input: unknown) {
      const ok =
        typeof input === "object" &&
        input !== null &&
        Object.entries(shape).every(([k, type]) => {
          const value = (input as Record<string, unknown>)[k];
          return value !== undefined && typeof value === type;
        });
      return ok ? { success: true } : { success: false, error: "invalid" };
    },
  };
}
describe("core: RuntimeKernel — registration & discovery", () => {
  let kernel: RuntimeKernel;

  beforeEach(() => {
    kernel = new RuntimeKernel();
  });

  it("registers an app in discovered state", () => {
    kernel.register(manifest("identity"));
    expect(kernel.has("identity")).toBe(true);
    expect(kernel.getStatus("identity")).toBe("discovered");
  });

  it("lists registered apps", () => {
    kernel.register(manifest("identity"));
    kernel.register(manifest("sales"));
    expect(kernel.listApps().map((a) => a.manifest.id)).toEqual([
      "identity",
      "sales",
    ]);
  });

  it("rejects duplicate registration", () => {
    kernel.register(manifest("identity"));
    expect(() => kernel.register(manifest("identity"))).toThrow(
      /already registered/,
    );
  });

  it("returns undefined status for unknown app", () => {
    expect(kernel.getStatus("unknown")).toBeUndefined();
  });
});

describe("core: RuntimeKernel — manifest validation (T-18)", () => {
  let kernel: RuntimeKernel;

  beforeEach(() => {
    kernel = new RuntimeKernel();
  });

  it("rejects a manifest with a non-semver version", () => {
    const bad = { ...manifest("identity"), version: "1.0" };
    expect(() => kernel.register(bad)).toThrow(/Invalid application manifest/);
  });

  it("rejects a manifest with an invalid permission (wildcard scope)", () => {
    const bad = {
      ...manifest("identity"),
      permissions: [
        {
          permission: "identity:user:read:*",
          category: "entity",
          scope: "*" as const,
        },
      ],
    };
    expect(() => kernel.register(bad)).toThrow(/Invalid application manifest/);
  });

  it("rejects a manifest missing the runtime entrypoint", () => {
    const { runtime, ...rest } = manifest("identity");
    void runtime;
    expect(() => kernel.register(rest)).toThrow(/Invalid application manifest/);
  });

  it("accepts a valid manifest with capabilities", () => {
    expect(() =>
      kernel.register({
        ...manifest("identity"),
        capabilities: [capability("user.lookup", "identity")],
      }),
    ).not.toThrow();
    expect(kernel.capabilities.resolve("user.lookup")?.ownerApp).toBe(
      "identity",
    );
  });
});

describe("core: RuntimeKernel — bootstrap & supervision", () => {
  it("bootstraps all apps to active", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity"));
    kernel.register(manifest("sales"));

    await kernel.bootstrap();

    expect(kernel.getStatus("identity")).toBe("active");
    expect(kernel.getStatus("sales")).toBe("active");
  });

  it("degrades an app whose initialization throws", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("failing"), {
      onInitializing: () => {
        throw new Error("boot error");
      },
    });
    kernel.register(manifest("sales"));

    await kernel.bootstrap();

    expect(kernel.getStatus("failing")).toBe("degraded");
    expect(kernel.getStatus("sales")).toBe("active");
  });

  it("degrade/disable transition app status", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity"));
    await kernel.bootstrap();

    await kernel.degrade("identity", new Error("health"));
    expect(kernel.getStatus("identity")).toBe("degraded");

    await kernel.disable("identity");
    expect(kernel.getStatus("identity")).toBe("disabled");
  });

  it("throws for unknown app on supervision", async () => {
    const kernel = new RuntimeKernel();
    await expect(kernel.degrade("nope", new Error("x"))).rejects.toThrow(
      /Unknown application/,
    );
  });

  it("emits state-change hooks", async () => {
    const states: string[] = [];
    const kernel = new RuntimeKernel({
      onAppStateChanged: (id, status) => states.push(`${id}:${status}`),
    });
    kernel.register(manifest("identity"));
    await kernel.bootstrap();
    expect(states).toEqual(["identity:initializing", "identity:active"]);
  });

  it("records lifecycle transition history", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity"));
    const entry = kernel.listApps()[0]!;
    await kernel.bootstrap();
    expect(entry.lifecycle.events().map((e) => e.to)).toEqual([
      "initializing",
      "active",
    ]);
  });
});

describe("core: DomainEventBus — authorization & tenant isolation", () => {
  it("denies publish without publish permission", async () => {
    const store = new EventStore();
    const permissions = new PermissionRegistry();
    const bus = new DomainEventBus(store, (perm, tenant, app) =>
      permissions.check(perm, tenant, app),
    );

    await expect(
      bus.publish(envelope("identity.user.created", { u: 1 }), "identity"),
    ).rejects.toThrow(/Permission denied/);
  });

  it("delivers to authorized subscriber only (per-subscriber check)", async () => {
    const store = new EventStore();
    const permissions = new PermissionRegistry();
    const bus = new DomainEventBus(store, (perm, tenant, app) =>
      permissions.check(perm, tenant, app),
    );

    permissions.grant(
      "*:identity.user.created:publish:tenant",
      TENANT,
      "identity",
    );
    permissions.grant(
      "*:identity.user.created:consume:tenant",
      TENANT,
      "sales",
    );

    const received: unknown[] = [];
    bus.subscribe(
      "identity.user.created",
      (e) => received.push(e.payload),
      "sales",
    );
    bus.subscribe(
      "identity.user.created",
      (e) => received.push(e.payload),
      "intruder",
    );

    await bus.publish(envelope("identity.user.created", { u: 1 }), "identity");

    expect(received).toEqual([{ u: 1 }]);
  });

  it("rejects wildcard scope in granted permission (exact-match scope)", () => {
    const permissions = new PermissionRegistry();

    expect(() =>
      permissions.grant(
        "*:identity.user.created:publish:*",
        TENANT,
        "identity",
      ),
    ).toThrow(/scope cannot be a wildcard/);
  });

  it("appends published events to the tenant-scoped store", async () => {
    const store = new EventStore();
    const permissions = new PermissionRegistry();
    const bus = new DomainEventBus(store, (perm, tenant, app) =>
      permissions.check(perm, tenant, app),
    );
    permissions.grant(
      "*:identity.user.created:publish:tenant",
      TENANT,
      "identity",
    );

    const evt = envelope("identity.user.created", { u: 1 });
    await bus.publish(evt, "identity");

    expect(store.query(TENANT)).toHaveLength(1);
    expect(store.query(TENANT)[0]!.envelope.type).toBe("identity.user.created");
  });
});

describe("core: RuntimeKernel — shared backbone", () => {
  it("routes events across apps through the kernel-owned bus", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity", ["identity.user.created"]));
    kernel.register(manifest("sales", [])); // sales only subscribes

    kernel.permissions.grant(
      "*:identity.user.created:publish:tenant",
      TENANT,
      "identity",
    );
    kernel.permissions.grant(
      "*:identity.user.created:consume:tenant",
      TENANT,
      "sales",
    );

    const received: unknown[] = [];
    kernel.bus.subscribe(
      "identity.user.created",
      (e) => received.push(e.payload),
      "sales",
    );

    await kernel.bus.publish(
      envelope("identity.user.created", { u: 7 }),
      "identity",
    );

    expect(received).toEqual([{ u: 7 }]);
    expect(kernel.store.query(TENANT)).toHaveLength(1);
  });
});

describe("core: RuntimeKernel — registries integration", () => {
  it("auto-registers declared capabilities from the manifest", () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [
        capability("user.lookup", "identity"),
        capability("authentication.validate", "identity"),
      ],
    });

    expect(kernel.capabilities.resolve("user.lookup")?.ownerApp).toBe(
      "identity",
    );
    expect(
      kernel.capabilities.resolve("authentication.validate")?.ownerApp,
    ).toBe("identity");
    expect(kernel.capabilities.resolve("unknown")).toBeUndefined();
  });

  it("auto-registers published event schemas with owner enforcement", () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity", ["identity.user.created"]));

    expect(
      kernel.eventSchemas.get("identity.user.created", "1.0.0")?.ownerApp,
    ).toBe("identity");
  });

  it("applies external grants from kernel config (Control Plane authority)", () => {
    const kernel = new RuntimeKernel(
      {},
      {
        config: {
          grants: [
            {
              app: "identity",
              permission: "*:identity.user.created:publish:tenant",
              tenant: TENANT,
            },
          ],
        },
      },
    );
    kernel.register(manifest("identity", ["identity.user.created"]));

    expect(
      kernel.permissions.check(
        "*:identity.user.created:publish:tenant",
        TENANT,
        "identity",
      ),
    ).toBe(true);
  });

  it("does not grant permissions declared by an app's own manifest (no self-grant)", () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      permissions: [
        {
          permission: "*:identity.user.created:publish:tenant",
          category: "event",
          scope: "tenant",
        },
      ],
    });

    expect(
      kernel.permissions.check(
        "*:identity.user.created:publish:tenant",
        TENANT,
        "identity",
      ),
    ).toBe(false);
  });

  it("rejects publishing an event not owned by the publisher (schema + ownership)", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity", ["identity.user.created"]));
    kernel.register(manifest("sales"));
    kernel.permissions.grant(
      "*:identity.user.created:publish:tenant",
      TENANT,
      "sales",
    );

    const evt = {
      ...envelope("identity.user.created", { u: 1 }),
      source: { application: "sales" },
    };
    await expect(kernel.bus.publish(evt, "sales")).rejects.toThrow(
      /Schema validation failed/,
    );
  });

  it("rejects publishing a non-declared event type (no schema)", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity", []));
    kernel.permissions.grant(
      "*:unknown.event:publish:tenant",
      TENANT,
      "identity",
    );

    const evt = envelope("unknown.event", { u: 1 });
    await expect(kernel.bus.publish(evt, "identity")).rejects.toThrow(
      /Schema validation failed/,
    );
  });

  it("allows publishing an owned declared event with permission", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity", ["identity.user.created"]));
    kernel.permissions.grant(
      "*:identity.user.created:publish:tenant",
      TENANT,
      "identity",
    );

    await expect(
      kernel.bus.publish(
        envelope("identity.user.created", { u: 1 }),
        "identity",
      ),
    ).resolves.toBeUndefined();
    expect(kernel.store.query(TENANT)).toHaveLength(1);
  });
});

describe("core: RuntimeKernel — capability execution (Flow B)", () => {
  it("executes a capability with a granted execute permission", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });
    kernel.permissions.grant(
      "identity:user.lookup:execute:tenant",
      TENANT,
      "sales",
    );
    kernel.registerCapabilityExecutor("user.lookup", (input) => ({
      found: true,
      input,
    }));

    const result = await kernel.executeCapability(
      "user.lookup",
      "sales",
      TENANT,
      { id: "u-1" },
    );

    expect(result).toEqual({ found: true, input: { id: "u-1" } });
  });

  it("denies capability execution without permission", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });

    await expect(
      kernel.executeCapability("user.lookup", "sales", TENANT, {}),
    ).rejects.toThrow(/Permission denied/);
  });

  it("throws for an unknown capability", async () => {
    const kernel = new RuntimeKernel();

    await expect(
      kernel.executeCapability("nope", "sales", TENANT, {}),
    ).rejects.toThrow(/Unknown capability/);
  });

  it("throws when a provider has not registered an executor", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });
    kernel.permissions.grant(
      "identity:user.lookup:execute:tenant",
      TENANT,
      "sales",
    );

    await expect(
      kernel.executeCapability("user.lookup", "sales", TENANT, {}),
    ).rejects.toThrow(/no registered provider/);
  });

  it("rejects input that violates the registered input contract", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });
    kernel.permissions.grant(
      "identity:user.lookup:execute:tenant",
      TENANT,
      "sales",
    );
    kernel.bindCapabilityContract("user.lookup", "identity", {
      inputValidator: validator({ id: "string" }),
    });
    kernel.registerCapabilityExecutor("user.lookup", (input) => ({
      found: true,
      input,
    }));

    await expect(
      kernel.executeCapability("user.lookup", "sales", TENANT, { id: 42 }),
    ).rejects.toThrow(/input contract violated/);
  });

  it("rejects output that violates the registered output contract", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });
    kernel.permissions.grant(
      "identity:user.lookup:execute:tenant",
      TENANT,
      "sales",
    );
    kernel.bindCapabilityContract("user.lookup", "identity", {
      outputValidator: validator({ found: "boolean" }),
    });
    kernel.registerCapabilityExecutor("user.lookup", () => ({
      found: "yes",
    }));

    await expect(
      kernel.executeCapability("user.lookup", "sales", TENANT, {}),
    ).rejects.toThrow(/output contract violated/);
  });

  it("passes valid input/output through the registered contracts", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });
    kernel.permissions.grant(
      "identity:user.lookup:execute:tenant",
      TENANT,
      "sales",
    );
    kernel.bindCapabilityContract("user.lookup", "identity", {
      inputValidator: validator({ id: "string" }),
      outputValidator: validator({ found: "boolean" }),
    });
    kernel.registerCapabilityExecutor("user.lookup", (input) => ({
      found: true,
      input,
    }));

    await expect(
      kernel.executeCapability("user.lookup", "sales", TENANT, {
        id: "u-1",
      }),
    ).resolves.toEqual({ found: true, input: { id: "u-1" } });
  });

  it("derives execute permissions from the manifest into the capability entry", () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      permissions: [
        {
          permission: "identity:user.lookup:execute:tenant",
          category: "capability",
          scope: "tenant",
        },
        {
          permission: "identity:user.read:execute:tenant",
          category: "capability",
          scope: "tenant",
        },
        {
          permission: "sales:order.read:execute:tenant",
          category: "capability",
          scope: "tenant",
        },
      ],
      capabilities: [
        capability("user.lookup", "identity"),
        capability("user.read", "identity"),
      ],
    });

    const lookup = kernel.resolveCapability("user.lookup");
    expect(lookup?.permissions).toEqual([
      "identity:user.lookup:execute:tenant",
    ]);
  });

  it("normalizes the capability entry from the manifest entrypoint", () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });

    expect(kernel.resolveCapability("user.lookup")?.entry).toBe(
      "/identity.js#user.lookup",
    );
  });

  it("rejects binding a contract to a capability owned by another app", () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });

    expect(() =>
      kernel.bindCapabilityContract("user.lookup", "sales", {
        inputValidator: validator({ id: "string" }),
      }),
    ).toThrow(/Unknown capability/);
  });

  it("binds a contract without clobbering the manifest-derived entry", () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [capability("user.lookup", "identity")],
    });

    kernel.bindCapabilityContract("user.lookup", "identity", {
      inputValidator: validator({ id: "string" }),
    });

    const entry = kernel.resolveCapability("user.lookup");
    expect(entry?.version).toBe("1.0.0");
    expect(entry?.entry).toBe("/identity.js#user.lookup");
    expect(entry?.inputValidator).toBeDefined();
    expect(entry?.outputValidator).toBeUndefined();
  });
});

describe("RuntimeKernel Lifecycle State Machine (Phase 1.1)", () => {
  it("transitions through CREATED -> INITIALIZING -> READY -> RUNNING -> STOPPED", async () => {
    const kernel = new RuntimeKernel();
    expect(kernel.stateMachineState).toBe("CREATED");

    await kernel.initialize();
    expect(kernel.stateMachineState).toBe("READY");

    await kernel.start();
    expect(kernel.stateMachineState).toBe("RUNNING");

    await kernel.stop();
    expect(kernel.stateMachineState).toBe("STOPPED");
  });
});
