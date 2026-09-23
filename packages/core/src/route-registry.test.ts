import { describe, it, expect } from "vitest";
import { RouteRegistry } from "./route-registry";

describe("RouteRegistry (Phase 4)", () => {
  it("registers and retrieves route contracts", () => {
    const registry = new RouteRegistry();
    const route = {
      id: "r1",
      appId: "portfolio",
      method: "GET" as const,
      path: "/vendables",
      handler: "listVendables",
    };

    registry.registerRoute(route);

    expect(registry.getRoute("GET", "/vendables")).toBe(route);
    expect(registry.listRoutes()).toHaveLength(1);
  });

  it("detects route conflicts between applications", () => {
    const registry = new RouteRegistry();
    const route1 = {
      id: "r1",
      appId: "portfolio",
      method: "GET" as const,
      path: "/items",
      handler: "listItems",
    };
    const route2 = {
      id: "r2",
      appId: "sales",
      method: "GET" as const,
      path: "/items",
      handler: "listSalesItems",
    };

    registry.registerRoute(route1);

    expect(() => registry.registerRoute(route2)).toThrow(/Route conflict detected/);
  });
});
