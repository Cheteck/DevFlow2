import { describe, expect, it } from "vitest";
import { RuntimeKernel } from "@mosaix/sdk";
import { createCitadelleApp, MANIFEST } from "./index";
import { IdentityController } from "./infrastructure/identity-controller";

describe("Citadelle Canonical Application Suite", () => {
  it("exports valid MANIFEST and creates app via factory", async () => {
    expect(MANIFEST.id).toBe("@apps/citadelle");
    const kernel = new RuntimeKernel();
    const tenant = { id: "test-tenant", organizationId: "test-org" };

    const { container, router, app } = await createCitadelleApp(kernel, tenant);
    expect(container).toBeDefined();
    expect(router).toBeDefined();
    expect(app.manifest.id).toBe("@apps/citadelle");
  });

  it("fails closed without AuthManager instead of issuing mock tokens", async () => {
    const controller = new IdentityController();
    const res = await controller.handleLogin({
      method: "POST",
      path: "/login",
      headers: {},
      body: { email: "user@mosaix.dev", password: "password123" },
    });

    expect(res.statusCode).toBe(503);
  });

  it("handles login via wired IdentityController after registration", async () => {
    const kernel = new RuntimeKernel();
    const tenant = { id: "test-tenant", organizationId: "test-org" };
    const { container } = await createCitadelleApp(kernel, tenant);
    const controller = container.resolve<IdentityController>(IdentityController);
    const email = `user-${Date.now()}@mosaix.dev`;

    const registered = await controller.handleRegister({
      method: "POST",
      path: "/register",
      headers: {},
      body: { email, displayName: "Test User", password: "password123" },
    });
    expect(registered.statusCode).toBe(201);

    const res = await controller.handleLogin({
      method: "POST",
      path: "/login",
      headers: {},
      body: { email, password: "password123" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
});
