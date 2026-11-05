import { describe, it, expect } from "vitest";
import {
  MosaixApp,
  KernelRuntimeClient,
  type RuntimeClient,
  RuntimeKernel,
} from "./index.js";
import type { ApplicationManifest, MosaixEventEnvelope, TenantIdentity } from "@mosaix/contracts";

describe("Mosaix SDK — Runtime Decoupling Suite", () => {
  const dummyManifest: ApplicationManifest = {
    id: "@apps/booking",
    name: "Booking App",
    version: "1.0.0",
    type: "application",
    runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
    capabilities: [{ id: "booking.test.ping", version: "1.0.0" }],
  };

  const dummyTenant: TenantIdentity = {
    id: "tenant-acme",
    organizationId: "org-acme",
  };

  it("operates autonomously with a decoupled mock RuntimeClient (Zero Kernel in-memory)", async () => {
    const invoked: Array<{ capabilityId: string; input: unknown }> = [];
    const published: MosaixEventEnvelope[] = [];
    const registeredExecutors = new Map<string, (input: unknown) => unknown>();

    const mockClient: RuntimeClient = {
      register: (_manifest) => {},
      executeCapability: async (capabilityId, callerApp, tenant, input) => {
        invoked.push({ capabilityId, input });
        if (capabilityId === "citadelle.identity.resolve") {
          return { userId: (input as { userId: string }).userId, name: "Alice", role: "citizen" };
        }
        return { status: "mocked", callerApp, tenant };
      },
      registerCapabilityExecutor: (capabilityId, executor) => {
        registeredExecutors.set(capabilityId, executor);
      },
      publishEvent: async (envelope) => {
        published.push(envelope);
      },
    };

    // Instantiate MosaixApp without a RuntimeKernel instance
    const app = MosaixApp.register({ manifest: dummyManifest, tenant: dummyTenant }, mockClient);

    expect(app.manifest.id).toBe("@apps/booking");
    expect(app.tenant.id).toBe("tenant-acme");

    // 1. Invoke remote capability via namespaced API
    const user = await app.capabilities.invoke<{ userId: string }, { userId: string; name: string }>(
      "citadelle.identity.resolve",
      { userId: "usr-123" }
    );
    expect(user.userId).toBe("usr-123");
    expect(user.name).toBe("Alice");
    expect(invoked).toHaveLength(1);
    expect(invoked[0].capabilityId).toBe("citadelle.identity.resolve");

    // 2. Backward compatibility invoke
    const legacyRes = await app.executeCapability("spaces.resource.read", { resourceId: "res-456" });
    expect(legacyRes).toEqual({
      status: "mocked",
      callerApp: "@apps/booking",
      tenant: dummyTenant,
    });

    // 3. Provide capability
    app.capabilities.provide("booking.slot.create", (input) => ({
      slotId: "slot-99",
      created: true,
      input,
    }));
    expect(registeredExecutors.has("booking.slot.create")).toBe(true);

    // 4. Publish domain event via namespaced API
    const env = await app.events.publish("booking.slot.created", "1.0.0", {
      slotId: "slot-99",
      capacity: 5,
    });
    expect(env.id).toBeDefined();
    expect(env.type).toBe("booking.slot.created");
    expect(env.source.application).toBe("@apps/booking");
    expect(published).toHaveLength(1);
    expect(published[0].type).toBe("booking.slot.created");

    // 5. Accessing kernel getter throws clear decoupled error
    expect(() => app.kernel).toThrow(/does not expose an in-process RuntimeKernel/);
  });

  it("operates seamlessly in Shared Runtime mode with KernelRuntimeClient", async () => {
    const kernel = new RuntimeKernel();
    await kernel.initialize();

    const app = MosaixApp.register(
      { manifest: dummyManifest, tenant: dummyTenant },
      kernel
    );

    expect(app.kernel).toBe(kernel);

    // Provide a capability via app
    app.capabilities.provide("booking.test.ping", (input) => {
      return { pong: true, input };
    });

    // Grant permission
    kernel.permissions.grant(
      "booking:test.ping:execute:tenant",
      dummyTenant,
      "@apps/booking"
    );

    // Execute through namespaced API
    const res = await app.capabilities.invoke<{ text: string }, { pong: boolean; input: { text: string } }>(
      "booking.test.ping",
      { text: "hello" }
    );
    expect(res.pong).toBe(true);
    expect(res.input.text).toBe("hello");

    await kernel.stop();
  });
});
