import { describe, expect, it } from "vitest";
import { ControlPlaneServer } from "./control-plane";

describe("ControlPlaneServer", () => {
  it("serves topology via Controller, Router, and Security Guard", async () => {
    const server = new ControlPlaneServer();
    server.controller.registerApp({ id: "identity", name: "Identity BAC", status: "ACTIVE" });

    const res = await server.router.handle({
      method: "GET",
      path: "/admin/topology",
      headers: {},
      principal: { sub: "admin-1", tenantId: "tenant-acme", roles: ["admin"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      applications: [{ id: "identity", name: "Identity BAC", status: "ACTIVE" }],
    });
  });

  it("rejects topology without an authenticated principal", async () => {
    const server = new ControlPlaneServer();
    const res = await server.router.handle({ method: "GET", path: "/admin/topology", headers: {} });
    expect(res.statusCode).toBe(401);
  });
});
