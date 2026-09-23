import { describe, expect, it } from "vitest";
import { RuntimeKernel } from "@mosaix/core";
import { createCitadelleApp } from "@apps/citadelle";
import { createCommerceApp } from "@apps/commerce";
import { createSpacesApp } from "@apps/spaces";
import { createImperiaApp } from "@apps/imperia";
import { createSolidarityApp } from "@apps/solidarity";

describe("MosaiX Golden Path — End-to-End Inter-BAC Orchestration", () => {
  it("orchestrates user onboarding, spaces creation, commerce orders, and imperia governance", async () => {
    // 1. Initialize Root RuntimeKernel
    const kernel = new RuntimeKernel();
    await kernel.initialize();
    await kernel.start();

    const tenant = { organizationId: "tenant-golden-path" };

    // 2. Grant permissions across the tenant for inter-BAC capabilities & events
    kernel.permissions.grant("*:*:*:tenant", tenant, "*");
    kernel.permissions.grant("*:citadelle.user.created:publish:tenant", tenant, "*");
    kernel.permissions.grant("*:citadelle.user.created:consume:tenant", tenant, "*");

    // 3. Bootstrap all Bounded Contexts onto the unified Kernel
    const citadelle = await createCitadelleApp(kernel, tenant);
    const spaces = await createSpacesApp(kernel, tenant);
    const commerce = await createCommerceApp(kernel, tenant);
    const imperia = await createImperiaApp(kernel, tenant);
    const solidarity = await createSolidarityApp(kernel, tenant);

    expect(citadelle.app).toBeDefined();
    expect(spaces.app).toBeDefined();
    expect(commerce.app).toBeDefined();
    expect(imperia.app).toBeDefined();
    expect(solidarity.app).toBeDefined();

    // 4. Inter-App Event Bus Subscription
    const receivedEvents: Array<{ type: string; payload: unknown }> = [];
    kernel.events.subscribe("citadelle.user.created", (envelope) => {
      receivedEvents.push({ type: envelope.type, payload: envelope.payload });
    }, "golden-path-subscriber");

    // 5. Step 1: User Registration via Citadelle Capability
    const userResult = await kernel.executeCapability(
      "citadelle.user.create",
      "integration-test",
      tenant,
      {
        email: "golden.path@mosaix.io",
        username: "golden_user",
        password: "SuperPassword123!",
      }
    ) as { id: string; email: string; username: string };

    expect(userResult).toBeDefined();
    expect(userResult.email).toBe("golden.path@mosaix.io");
    const userId = userResult.id;

    // Publish user created event from Citadelle
    await citadelle.app.publish(
      "citadelle.user.created",
      "1.0.0",
      { userId, email: "golden.path@mosaix.io" }
    );

    // 6. Step 2: Space Creation for the User via Spaces Capability
    const spaceResult = await kernel.executeCapability(
      "spaces.space.create",
      "@apps/spaces",
      tenant,
      {
        name: "Golden Path HQ",
        ownerUserId: userId,
        templateId: "business",
      }
    ) as { id: string; name: string };

    expect(spaceResult).toBeDefined();
    expect(spaceResult.name).toBe("Golden Path HQ");

    // 7. Step 3: Commerce Order Placement via Commerce Capability
    const orderResult = await kernel.executeCapability(
      "commerce.order.create",
      "@apps/commerce",
      tenant,
      {
        userId,
        vendableId: "plan-pro-yearly",
        amount: 299,
      }
    ) as { order: { id: string; userId: string; status: string }; sagaState: unknown };

    expect(orderResult).toBeDefined();
    expect(orderResult.order.userId).toBe(userId);
    expect(orderResult.order.status).toBe("Paid");

    // 8. Step 4: Solidarity Incident declaration via Solidarity Capability
    const incidentResult = await kernel.executeCapability(
      "solidarity.incident.create",
      "@apps/solidarity",
      tenant,
      {
        title: "Community Power Outage",
        location: "District 9",
        severity: "HIGH",
      }
    ) as { id: string; title: string };

    expect(incidentResult).toBeDefined();
    expect(incidentResult.title).toBe("Community Power Outage");

    // 9. Step 5: Imperia Governance & Topology Inspection
    const governanceTopology = await kernel.executeCapability(
      "imperia.governance.inspect",
      "admin-audit",
      tenant,
      {}
    ) as { status?: string } | undefined;

    expect(governanceTopology).toBeDefined();
    expect(receivedEvents.some((e) => e.type === "citadelle.user.created")).toBe(true);
  });
});
