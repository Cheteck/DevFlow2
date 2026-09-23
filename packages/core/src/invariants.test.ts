/**
 * Property-style kernel invariants (ADR-0002 stability criteria).
 *
 * These tests assert laws that must hold under any sequence of operations,
 * protecting the kernel from future drift:
 *   1. No invalid lifecycle transition is ever recorded.
 *   2. No capability is executed without an explicit execute permission.
 *   3. No unregistered/foreign event is ever published.
 */

import { describe, it, expect } from "vitest";
import {
  RuntimeKernel,
  AppLifecycle,
  LifecycleError,
  KernelError,
  EventError,
} from "@mosaix/core";
import type {
  ApplicationManifest,
  MosaixEventEnvelope,
  TenantIdentity,
} from "@mosaix/contracts";

const TENANT: TenantIdentity = {
  organizationId: "acme-corp",
  spaceId: "retail-chain",
};

function manifest(id: string, events: string[] = []): ApplicationManifest {
  return {
    type: "application",
    id,
    name: id,
    version: "1.0.0",
    metadata: { name: id },
    domain: { entities: [], events },
    runtime: {
      entrypoint: `/${id}.js`,
      isolation: "sandbox",
      engine: "web-worker",
    },
  };
}

function envelope(type: string, source: string): MosaixEventEnvelope {
  return {
    id: "evt-" + Math.random().toString(36).slice(2),
    type,
    version: "1.0.0",
    source: { application: source },
    tenant: TENANT,
    timestamp: new Date().toISOString(),
    correlationId: "corr-1",
    payload: {},
    security: { classification: "internal" },
  };
}

describe("invariant: lifecycle transitions are always valid", () => {
  it("records only legal transitions across many operation sequences", async () => {
    const legal = new Set([
      "discovered->initializing",
      "discovered->degraded",
      "discovered->registered",
      "discovered->failed",
      "registered->ready",
      "registered->initializing",
      "registered->degraded",
      "initializing->active",
      "initializing->degraded",
      "initializing->failed",
      "initializing->ready",
      "ready->active",
      "ready->initializing",
      "ready->degraded",
      "ready->disabled",
      "active->degraded",
      "active->disabled",
      "active->draining",
      "degraded->initializing",
      "degraded->ready",
      "degraded->disabled",
      "degraded->failed",
      "draining->disabled",
      "draining->degraded",
      "failed->initializing",
    ]);

    for (let i = 0; i < 20; i++) {
      const lc = new AppLifecycle();
      const ops = [
        () => lc.markRegistered(),
        () => lc.markReady(),
        () => lc.initialize(),
        () => lc.degrade(new Error("x")),
        () => lc.disable(),
        () => lc.drain(),
        () => lc.retry(),
      ];
      for (const op of ops) {
        try {
          await op();
        } catch (error) {
          expect(error).toBeInstanceOf(LifecycleError);
        }
      }
      for (const event of lc.events()) {
        expect(legal.has(`${event.from}->${event.to}`)).toBe(true);
      }
    }
  });
});

describe("invariant: no capability executes without explicit permission", () => {
  it("execution without permission always fails with KernelError", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [
        {
          id: "user.lookup",
          version: "1.0.0",
          provider: { applicationId: "identity" },
          operations: [{ name: "invoke", input: "in", output: "out" }],
        },
      ],
    });
    kernel.registerCapabilityExecutor("user.lookup", () => ({ ok: true }));

    for (const caller of ["sales", "inventory", "catalog"]) {
      await expect(
        kernel.executeCapability("user.lookup", caller, TENANT, {}),
      ).rejects.toBeInstanceOf(KernelError);
    }
  });

  it("execution succeeds exactly when the permission is granted", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [
        {
          id: "user.lookup",
          version: "1.0.0",
          provider: { applicationId: "identity" },
          operations: [{ name: "invoke", input: "in", output: "out" }],
        },
      ],
    });
    kernel.registerCapabilityExecutor("user.lookup", (input) => ({
      ok: true,
      input,
    }));

    await expect(
      kernel.executeCapability("user.lookup", "sales", TENANT, {}),
    ).rejects.toBeInstanceOf(KernelError);

    kernel.permissions.grant(
      "identity:user.lookup:execute:tenant",
      TENANT,
      "sales",
    );
    await expect(
      kernel.executeCapability("user.lookup", "sales", TENANT, { id: 1 }),
    ).resolves.toEqual({ ok: true, input: { id: 1 } });
  });
});

describe("invariant: no unregistered or foreign event is published", () => {
  it("rejects a foreign-owned event type and an undeclared type", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity", ["identity.user.created"]));
    kernel.permissions.grant(
      "*:identity.user.created:publish:tenant",
      TENANT,
      "identity",
    );
    kernel.permissions.grant(
      "*:other.event:publish:tenant",
      TENANT,
      "identity",
    );

    const foreign = {
      ...envelope("identity.user.created", "sales"),
    };
    await expect(kernel.bus.publish(foreign, "sales")).rejects.toBeInstanceOf(
      EventError,
    );

    const undeclared = envelope("other.event", "identity");
    await expect(
      kernel.bus.publish(undeclared, "identity"),
    ).rejects.toBeInstanceOf(EventError);
  });

  it("publishes exactly an owned, declared event", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity", ["identity.user.created"]));
    kernel.permissions.grant(
      "*:identity.user.created:publish:tenant",
      TENANT,
      "identity",
    );

    await expect(
      kernel.bus.publish(
        envelope("identity.user.created", "identity"),
        "identity",
      ),
    ).resolves.toBeUndefined();
    expect(kernel.store.query(TENANT)).toHaveLength(1);
  });
});

describe("invariant: permission grammar must be 4 parts with valid scope", () => {
  it("rejects manifests with 3-part permissions or wildcard scope", () => {
    const kernel = new RuntimeKernel();
    expect(() => {
      kernel.register({
        ...manifest("invalid-app-1"),
        permissions: ["sales:order:create"] as unknown as string[],
      });
    }).toThrow(/permission must follow 4-part grammar/);

    expect(() => {
      kernel.register({
        ...manifest("invalid-app-2"),
        permissions: ["sales:order:create:*"] as unknown as string[],
      });
    }).toThrow(/scope cannot be a wildcard/);

    expect(() => {
      kernel.register({
        ...manifest("invalid-app-3"),
        permissions: ["sales:order:create:invalid_scope"] as unknown as string[],
      });
    }).toThrow(/invalid scope/);
  });

  it("accepts manifests with valid 4-part permissions", () => {
    const kernel = new RuntimeKernel();
    expect(() => {
      kernel.register({
        ...manifest("valid-app"),
        permissions: [
          "valid-app:order:create:tenant",
          "valid-app:order:read:organization",
          "valid-app:order:update:store",
          "valid-app:order:delete:self",
        ],
      });
    }).not.toThrow();
  });
});

describe("invariant: tenant normalization in event bus and store", () => {
  it("normalizes string tenants, undefined tenants, and structured tenants correctly", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("tenant-app", ["tenant-app.event.emitted"]));
    
    kernel.permissions.grant(
      "*:tenant-app.event.emitted:publish:tenant",
      { organizationId: "default" },
      "tenant-app",
    );
    kernel.permissions.grant(
      "*:tenant-app.event.emitted:publish:tenant",
      { organizationId: "custom-org" },
      "tenant-app",
    );

    // Test with undefined tenant
    const envUndefined = {
      ...envelope("tenant-app.event.emitted", "tenant-app"),
      tenant: undefined,
    };
    await expect(kernel.bus.publish(envUndefined, "tenant-app")).resolves.toBeUndefined();
    expect(kernel.store.query({ organizationId: "default" })).toHaveLength(1);

    // Test with string tenant
    const envString = {
      ...envelope("tenant-app.event.emitted", "tenant-app"),
      tenant: "custom-org" as unknown as TenantIdentity,
    };
    await expect(kernel.bus.publish(envString, "tenant-app")).resolves.toBeUndefined();
    expect(kernel.store.query({ organizationId: "custom-org" })).toHaveLength(1);
    expect(kernel.store.query("custom-org")).toHaveLength(1);
  });
});

