/**
 * Solidarity descriptor tests: real service data, honest empty states.
 * No fictitious needs or volunteers — without a service the views render
 * empty states, and beneficiary identities never appear.
 */

import { describe, it, expect } from "vitest";
import { createSolidarityDescriptor, toOpsNeeds } from "./solidarity-view";
import { createSolidarityComposition } from "../composition-root.js";

function ctx(query: Record<string, string>) {
  return {
    tenantId: "default",
    spaceId: null,
    user: { id: "user-1", roles: ["member"], permissions: [] },
    theme: { mode: "dark" },
    request: { path: "/solidarity", query, headers: {} },
  } as never;
}

async function seededService() {
  const { solidarityService } = createSolidarityComposition();
  const incident = await solidarityService.createIncident({
    code: "INC-2026-0001",
    title: "Jijel Water Shortage",
    description: "Drinking water shortage",
    type: "FLOOD",
    severityLevel: "CRITICAL",
    geoZone: "Jijel",
    startDate: new Date().toISOString(),
    coordinatingOrgId: "ORG-001",
  });
  await solidarityService.declareNeed({
    incidentId: incident.id,
    requesterId: "USER-001",
    type: "WATER",
    quantityRequired: 1000,
    urgency: "CRITICAL",
    affectedPeopleCount: 95,
    geoZone: "Jijel",
  });
  return solidarityService;
}

describe("toOpsNeeds", () => {
  it("projects stored needs without personal data", async () => {
    const projected = toOpsNeeds(await seededService());
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({ title: "WATER", zone: "Jijel", requested: 1000, distributed: 0 });
    expect(JSON.stringify(projected)).not.toMatch(/USER-001/);
  });
});

describe("createSolidarityDescriptor", () => {
  it("lists real needs with strict coverage", async () => {
    const descriptor = createSolidarityDescriptor({ solidarityService: await seededService() });
    const result = await descriptor.render(ctx({ view: "needs" }));
    expect(result.contentHtml).toContain("WATER");
    expect(result.contentHtml).toContain("Jijel");
    expect(result.contentHtml).toContain("0%");
    expect(result.contentHtml).not.toContain("need-001");
  });

  it("renders honest empty states without a service", async () => {
    const descriptor = createSolidarityDescriptor();
    const list = await descriptor.render(ctx({ view: "list" }));
    expect(list.contentHtml).toContain("Aucune operation pour le moment");
    const needs = await descriptor.render(ctx({ view: "needs" }));
    expect(needs.contentHtml).toContain("Aucun besoin pour le moment");
  });

  it("never renders fictitious volunteers", async () => {
    const descriptor = createSolidarityDescriptor({ solidarityService: await seededService() });
    const result = await descriptor.render(ctx({ view: "volunteers" }));
    expect(result.contentHtml).toContain("Citadelle");
    expect(result.contentHtml).not.toContain("VOL-8491-DZ");
  });
});
