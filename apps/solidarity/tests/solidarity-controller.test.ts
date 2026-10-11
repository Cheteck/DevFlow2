import { describe, it, expect } from "vitest";
import { Router } from "@mosaix/http";
import type { HttpRequest } from "@mosaix/http";
import {
  SolidarityController,
  mountSolidarityControllerRoutes,
  generateSolidarityOpenApi,
} from "../src/infrastructure/solidarity-controller.js";
import { createSolidarityComposition } from "../src/composition-root.js";

const READER = { sub: "op-1", tenantId: "t1", roles: [], permissions: ["solidarity:need:declare:tenant"] };
const MATCHER = {
  sub: "op-1",
  tenantId: "t1",
  roles: [],
  permissions: ["solidarity:need:declare:tenant", "solidarity:matching:propose:tenant"],
};
const ALLOCATOR = {
  sub: "op-1",
  tenantId: "t1",
  roles: [],
  permissions: ["solidarity:allocation:confirm:tenant"],
};

function req(partial: Partial<HttpRequest>): HttpRequest {
  return { method: "GET", path: "/", headers: {}, ...partial };
}

async function seededController() {
  const { solidarityService } = createSolidarityComposition();
  const incident = await solidarityService.createIncident({
    code: "INC-CTRL-1",
    title: "Ctrl",
    description: "Controller test",
    type: "FLOOD",
    severityLevel: "HIGH",
    geoZone: "Jijel",
    startDate: new Date().toISOString(),
    coordinatingOrgId: "ORG-001",
  });
  const need = await solidarityService.declareNeed({
    incidentId: incident.id,
    requesterId: "USER-001",
    type: "WATER",
    quantityRequired: 1000,
    urgency: "HIGH",
    affectedPeopleCount: 50,
    geoZone: "Jijel",
  });
  const donation = await solidarityService.submitDonation({
    donorId: "DONOR-001",
    donorType: "CITIZEN",
    itemType: "WATER",
    quantity: 400,
    geoZone: "Algiers",
  });
  const resource = solidarityService.getResources().find((r) => r.donationId === donation.id)!;
  return { controller: new SolidarityController(solidarityService), need, resource };
}

describe("SolidarityController (Guard.authorize + error mapping)", () => {
  it("returns 401 without a principal", async () => {
    const { controller, need } = await seededController();
    const res = await controller.getNeedCoverage(req({ query: { needId: need.id } }));
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 without the required permission", async () => {
    const { controller, need } = await seededController();
    const res = await controller.getNeedCoverage(req({ principal: { sub: "x", tenantId: "t1" }, query: { needId: need.id } }));
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 on missing needId and 404 on unknown need", async () => {
    const { controller } = await seededController();
    expect((await controller.getNeedCoverage(req({ principal: READER, query: {} }))).statusCode).toBe(400);
    const missing = await controller.getNeedCoverage(req({ principal: READER, query: { needId: "NEED-NOPE" } }));
    expect(missing.statusCode).toBe(404);
  });

  it("returns strict coverage for a stored need", async () => {
    const { controller, need } = await seededController();
    const res = await controller.getNeedCoverage(req({ principal: READER, query: { needId: need.id } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ needId: need.id, requested: 1000, distributed: 0, percent: 0 });
  });

  it("guards matching proposals behind its permission", async () => {
    const { controller, need } = await seededController();
    expect((await controller.getMatches(req({ principal: READER, query: { needId: need.id } }))).statusCode).toBe(403);
    const res = await controller.getMatches(req({ principal: MATCHER, query: { needId: need.id } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { count: number }).count).toBe(1);
  });

  it("exports HXL aggregates without PII", async () => {
    const { controller } = await seededController();
    const res = await controller.getHxlReport(req({ principal: READER, query: { crisis: "Jijel" } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { count: number }).count).toBe(1);
  });

  it("confirms allocations: 400/404/409 then 201, replay stays idempotent", async () => {
    const { controller, need, resource } = await seededController();
    const post = (principal: typeof ALLOCATOR, body: unknown) =>
      controller.confirmAllocation(req({ method: "POST", path: "/solidarity/allocations", principal, body }));

    expect(await post(READER as never, {})).toMatchObject({ statusCode: 403 });
    expect(await post(ALLOCATOR, {})).toMatchObject({ statusCode: 400 });
    expect(
      await post(ALLOCATOR, { resourceId: "RES-NOPE", needId: need.id, quantity: 10, idempotencyKey: "k-404" }),
    ).toMatchObject({ statusCode: 404 });
    expect(
      await post(ALLOCATOR, { resourceId: resource.id, needId: need.id, quantity: 500, idempotencyKey: "k-409" }),
    ).toMatchObject({ statusCode: 409 });

    const created = await post(ALLOCATOR, {
      resourceId: resource.id,
      needId: need.id,
      quantity: 150,
      idempotencyKey: "k-201",
    });
    expect(created.statusCode).toBe(201);

    const replay = await post(ALLOCATOR, {
      resourceId: resource.id,
      needId: need.id,
      quantity: 150,
      idempotencyKey: "k-201",
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.body).toMatchObject({ alreadyProcessed: true });
  });

  it("mounts routes and generates an OpenAPI spec without errors", async () => {
    const { solidarityService } = createSolidarityComposition();
    const router = new Router();
    mountSolidarityControllerRoutes(router, new SolidarityController(solidarityService));
    const paths = router.getRoutes().map((r) => `${r.method} ${r.path}`);
    expect(paths).toContain("GET /solidarity/need-coverage");
    expect(paths).toContain("GET /solidarity/matches");
    expect(paths).toContain("GET /solidarity/hxl");
    expect(paths).toContain("POST /solidarity/allocations");

    const spec = generateSolidarityOpenApi(router) as { paths?: Record<string, unknown> };
    expect(spec.paths).toBeDefined();
    expect(spec.paths?.["/solidarity/allocations"]).toBeDefined();
  });
});
