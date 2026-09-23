import { describe, expect, it } from "vitest";
import { createImperiaComposition, createImperiaApp, MANIFEST } from "./index.js";
import { registerImperiaUISlots } from "../frontend/src/index.js";
import { RuntimeKernel } from "@mosaix/sdk";

describe("MosaiX Imperia Application Suite", () => {
  it("exports valid MANIFEST and creates app via factory", async () => {
    expect(MANIFEST.id).toBe("@apps/imperia");
    const kernel = new RuntimeKernel();
    const tenant = { id: "test-tenant", organizationId: "test-org" };

    const { container, router, app } = await createImperiaApp(kernel, tenant);
    expect(container).toBeDefined();
    expect(router).toBeDefined();
    expect(app.manifest.id).toBe("@apps/imperia");
  });

  it("instantiates Composition Root with Container, Router, and Governance Services", () => {
    const composition = createImperiaComposition();

    expect(composition.container).toBeDefined();
    expect(composition.router).toBeDefined();
    expect(composition.controller).toBeDefined();
    expect(composition.policyRegistry).toBeDefined();
    expect(composition.topologyService).toBeDefined();
    expect(composition.settingsService).toBeDefined();
    expect(composition.slotResolver).toBeDefined();
    expect(composition.pluginManager).toBeDefined();
    expect(composition.controlPlaneSupervisor).toBeDefined();
    expect(composition.migrationGovernance).toBeDefined();
    expect(composition.controlPlaneServer).toBeDefined();
  });

  it("handles health check and topology endpoints via ImperiaGovernanceController and calculates average conformance score", async () => {
    const composition = createImperiaComposition();

    const healthResponse = await composition.controller.getHealth({
      method: "GET",
      path: "/imperia/health",
      headers: {},
    });

    expect(healthResponse.statusCode).toBe(200);
    const healthBody = healthResponse.body as { application: string; governanceState: string };
    expect(healthBody.application).toBe("imperia");
    expect(healthBody.governanceState).toBe("operational");

    const topologyResponse = await composition.controller.getTopologySummary({
      method: "GET",
      path: "/imperia/topology",
      headers: {},
    });

    expect(topologyResponse.statusCode).toBe(200);
    const topologyBody = topologyResponse.body as { activeBoundedContexts: string[]; totalContexts: number; averageConformanceScore: number };
    expect(topologyBody.activeBoundedContexts).toContain("imperia");
    expect(topologyBody.totalContexts).toBe(4);
    expect(topologyBody.averageConformanceScore).toBe(100);
  });

  it("supervises Control Plane DLQ and Circuit Breakers (Proposition 1)", async () => {
    const composition = createImperiaComposition();
    const admin = { principal: { sub: "admin-1", tenantId: "tenant-acme", roles: ["admin"] } };

    const dlqRes = await composition.controller.listDLQItems({
      method: "GET",
      path: "/imperia/dlq",
      headers: {},
      ...admin,
    });

    expect(dlqRes.statusCode).toBe(200);
    const dlqBody = dlqRes.body as { dlqItems: Array<{ id: string }> };
    expect(dlqBody.dlqItems.length).toBeGreaterThan(0);

    const replayRes = await composition.controller.replayDLQItem({
      method: "POST",
      path: "/imperia/dlq/replay",
      headers: {},
      body: { id: "dlq-001" },
      ...admin,
    });

    expect(replayRes.statusCode).toBe(200);

    const cbRes = await composition.controller.listCircuitBreakers({
      method: "GET",
      path: "/imperia/circuit-breakers",
      headers: {},
      ...admin,
    });

    expect(cbRes.statusCode).toBe(200);
    const cbBody = cbRes.body as { circuitBreakers: Array<{ id: string; state: string }> };
    expect(cbBody.circuitBreakers.length).toBeGreaterThan(0);
  });

  it("supervises database schema migrations and previews SQL (Proposition 3)", async () => {
    const composition = createImperiaComposition();

    const statusRes = await composition.controller.listMigrations({
      method: "GET",
      path: "/imperia/migrations/status",
      headers: {},
    });

    expect(statusRes.statusCode).toBe(200);
    const statusBody = statusRes.body as { migrations: Array<{ id: string; name: string }> };
    expect(statusBody.migrations.length).toBe(4);

    const previewRes = await composition.controller.previewMigrationSQL({
      method: "POST",
      path: "/imperia/migrations/preview",
      headers: {},
      body: { id: "app.imperia.v1.001_audit_logs" },
    });

    expect(previewRes.statusCode).toBe(200);
    const previewBody = previewRes.body as { preview: { sqlPreview: string; dryRunSuccess: boolean } };
    expect(previewBody.preview.dryRunSuccess).toBe(true);
    expect(previewBody.preview.sqlPreview).toContain("CREATE TABLE IF NOT EXISTS imperia_audit_logs");
  });

  it("manages plugins with a PrestaShop Module Manager lifecycle", async () => {
    const composition = createImperiaComposition();

    const listRes = await composition.controller.listPlugins({
      method: "GET",
      path: "/imperia/plugins",
      headers: {},
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.body as { plugins: Array<{ id: string }> };
    expect(listBody.plugins.length).toBeGreaterThan(0);
  });

  it("exports UI slot contributions for frontend extension", () => {
    const slots = registerImperiaUISlots();
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.slotId).toBe("admin.dashboard.widget");
  });

  it("rejects admin endpoints without an admin principal", async () => {
    const composition = createImperiaComposition();

    const anonymous = await composition.controller.listDLQItems({
      method: "GET",
      path: "/imperia/dlq",
      headers: {},
    });
    expect(anonymous.statusCode).toBe(403);

    const nonAdmin = await composition.controller.listDLQItems({
      method: "GET",
      path: "/imperia/dlq",
      headers: {},
      principal: { sub: "usr_bob", tenantId: "tenant-acme", roles: ["user"] },
    });
    expect(nonAdmin.statusCode).toBe(403);
  });
});
