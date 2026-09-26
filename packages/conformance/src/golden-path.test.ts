import { describe, expect, it } from "vitest";
import { RuntimeKernel } from "@mosaix/core";

describe("MosaiX Golden Path — End-to-End Canonical Orchestration", () => {
  it("executes canonical application lifecycle (boot, manifest, capability execution, event subscription, and permission check) < 5s", async () => {
    const startTime = Date.now();

    // 1. Initialize Root RuntimeKernel
    const kernel = new RuntimeKernel();

    const tenant = { organizationId: "tenant-golden-path" };

    // Grant all tenant permissions
    kernel.permissions.grant("*:*:*:tenant", tenant, "*");

    // Register canonical application manifest
    const manifest = {
      type: "application" as const,
      id: "identity",
      name: "Identity Bounded Context",
      version: "1.0.0",
      domain: { name: "identity" },
      runtime: { entrypoint: "./src/start.ts" },
      capabilities: [{ id: "identity.user.create", version: "1.0.0" }],
      permissions: ["identity:user:create:tenant"],
      events: ["identity.user.created"],
    };

    kernel.register(manifest);

    kernel.registerCapabilityExecutor("identity.user.create", async (payload) => {
      const p = payload as { email: string; username: string };
      return { id: "usr_12345", email: p.email, username: p.username };
    });

    await kernel.initialize();
    await kernel.start();

    // 2. Event Bus Subscription
    const receivedEvents: Array<{ type: string; payload: unknown }> = [];
    kernel.events.subscribe(
      "identity.user.created",
      (envelope) => {
        receivedEvents.push({ type: envelope.type, payload: envelope.payload });
      },
      "golden-path-subscriber"
    );

    // 3. Capability Execution
    const userResult = (await kernel.executeCapability(
      "identity.user.create",
      "canonical-app",
      tenant,
      {
        email: "golden.path@mosaix.io",
        username: "golden_user",
      }
    )) as { id: string; email: string; username: string };

    expect(userResult).toBeDefined();
    expect(userResult.id).toBe("usr_12345");
    expect(userResult.email).toBe("golden.path@mosaix.io");

    // 4. Event Publishing with complete envelope
    await kernel.events.publish(
      {
        id: "evt_12345",
        type: "identity.user.created",
        version: "1.0.0",
        source: {
          application: "identity",
        },
        tenant,
        timestamp: new Date().toISOString(),
        payload: {
          userId: userResult.id,
          email: userResult.email,
        },
      },
      "identity"
    );

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]?.type).toBe("identity.user.created");

    // 5. Assert Execution Speed < 5000ms
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000);

    await kernel.stop();
  });
});
