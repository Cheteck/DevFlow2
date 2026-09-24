import { describe, expect, it } from "vitest";
import { RuntimeKernel } from "@mosaix/core";
import { MosaixApp } from "@mosaix/sdk";

describe("E2E Multi-BAC Integration", () => {
  it("registers and boots multiple BACs in the runtime kernel", async () => {
    const kernel = new RuntimeKernel();
    const tenant = { tenantId: "t-1", organizationId: "org-1", storeId: "s-1" };

    const app1 = MosaixApp.register({
      manifest: {
        type: "application",
        id: "@apps/citadelle",
        version: "1.0.0",
        domain: { name: "citadelle" },
        runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
        capabilities: [{ id: "citadelle.user.lookup", version: "1.0.0" }]
      },
      tenant
    }, kernel);

    const app2 = MosaixApp.register({
      manifest: {
        type: "application",
        id: "@apps/booking",
        version: "1.0.0",
        domain: { name: "booking" },
        runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
        capabilities: [{ id: "booking.slot.list", version: "1.0.0" }]
      },
      tenant
    }, kernel);

    expect(app1.getId()).toBe("@apps/citadelle");
    expect(app2.getId()).toBe("@apps/booking");
    expect(kernel.listApps().length).toBe(2);
  });
});
