import { describe, expect, it } from "vitest";
import { RuntimeKernel } from "@mosaix/sdk";
import { createPortfolioApp, MANIFEST } from "./index";

describe("Portfolio BAC (Product Information Management & Decoupled Knowledge)", () => {
  const tenant = { id: "test-tenant", organizationId: "test-org" };

  it("exports valid MANIFEST and creates app via factory", async () => {
    expect(MANIFEST.id).toBe("@apps/portfolio");
    const kernel = new RuntimeKernel();
    const { container, router, app } = await createPortfolioApp(kernel, tenant);
    expect(container).toBeDefined();
    expect(router).toBeDefined();
    expect(app.manifest.id).toBe("@apps/portfolio");
  });

  it("provides vendable search capability", async () => {
    // Le boundary exige un grant Control Plane explicite (pas de self-grant).
    // Note : le provider enregistre l'app sous le tenant "default" (tenant
    // passé à createPortfolioApp ignoré — dette connue), le grant suit.
    const kernel = new RuntimeKernel({}, {
      config: {
        grants: [
          {
            app: "@apps/portfolio",
            permission: "portfolio:vendable.search:execute:tenant",
            tenant: { organizationId: "default" },
          },
        ],
      },
    });
    const { app } = await createPortfolioApp(kernel, tenant);

    const result = (await app.executeCapability(
      "portfolio.vendable.search",
      { criteria: {} },
    )) as unknown[];

    expect(Array.isArray(result)).toBe(true);
  });
});
