import { describe, it, expect } from "vitest";
import {
  assessNeedPriority,
  computeNeedPriorityScore,
  calculateCoveragePercent,
  areUnitsCompatible,
  detectDuplicateNeeds,
  allocateStockSafely,
  confirmDistributionSafely,
  matchVolunteerForMission,
  detectHubSaturation,
  buildHxlRows,
  HXL_HEADER,
  canonicalizeJson,
  sha256Hex,
  computeBeneficiaryHmac,
  IdempotencyRegistry,
  type ResourceStock,
  type VolunteerCapacity,
} from "../src/domain/solidarity-operational-rules.js";

function makeStock(overrides: Partial<ResourceStock> = {}): ResourceStock {
  return {
    id: "stk-1",
    hubId: "hub-1",
    category: "WATER",
    itemName: "Drinking water",
    unit: "L",
    physical: 1000,
    reserved: 800,
    available: 200,
    unusable: 0,
    lastMovedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("solidarity operational rules (responsibilities.md §2, §7, §8)", () => {
  it("coverage is distributed / requested only: 1000 requested, 200 distributed => 20%", () => {
    expect(calculateCoveragePercent(1000, 200)).toBe(20);
  });

  it("unverified vital need triggers urgent verification, never silent deprioritisation", () => {
    const assessment = assessNeedPriority({
      category: "WATER",
      requested: 1000,
      distributed: 0,
      urgency: 5,
      isEnclaved: true,
      verifiedAt: undefined,
    });
    expect(assessment.verifyUrgently).toBe(true);
    expect(assessment.gravity).toBe(5);
    expect(assessment.confidence).toBeLessThanOrEqual(2);
    expect(assessment.reasons.some((r) => r.includes("UNVERIFIED VITAL ALERT"))).toBe(true);
  });

  it("priority score stays explainable and derived from the assessment", () => {
    const score = computeNeedPriorityScore({ category: "MEDICAL", requested: 100, distributed: 0, urgency: 5 });
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("refuses to add incompatible units", () => {
    expect(areUnitsCompatible("L", "L")).toBe(true);
    expect(areUnitsCompatible("kg", "KG")).toBe(true);
    expect(areUnitsCompatible("L", "KG")).toBe(false);
  });

  it("detects duplicates without deleting reports, flags contradictions", () => {
    const out = detectDuplicateNeeds([
      { id: "a", type: "WATER", requested: 1000, unit: "L", location: { latitude: 36.7, longitude: 5.8 } },
      { id: "b", type: "WATER", requested: 1000, unit: "L", location: { latitude: 36.701, longitude: 5.801 } },
      { id: "c", type: "WATER", requested: 5000, unit: "L", location: { latitude: 36.702, longitude: 5.802 } },
    ]);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.some((d) => d.contradiction)).toBe(true);
  });

  it("refuses over-allocation: available = physical - reserved", () => {
    const registry = new IdempotencyRegistry();
    const over = allocateStockSafely(makeStock(), 300, "L", "need-1", "key-over-1", registry);
    expect(over.success).toBe(false);
    expect(over.error).toMatch(/Over-allocation refused/);

    const valid = allocateStockSafely(makeStock(), 150, "L", "need-1", "key-valid-1", registry);
    expect(valid.success).toBe(true);
    expect(valid.updatedStock?.reserved).toBe(950);
    expect(valid.updatedStock?.available).toBe(50);
  });

  it("replays allocations idempotently on the same key", () => {
    const registry = new IdempotencyRegistry();
    const first = allocateStockSafely(makeStock(), 5, "L", "need-1", "idem-key-1", registry);
    expect(first.success).toBe(true);
    expect(first.alreadyProcessed).toBeFalsy();
    const replay = allocateStockSafely(makeStock(), 5, "L", "need-1", "idem-key-1", registry);
    expect(replay.success).toBe(true);
    expect(replay.alreadyProcessed).toBe(true);
  });

  it("requires justification for intrusive distribution proofs", () => {
    const registry = new IdempotencyRegistry();
    const refused = confirmDistributionSafely(
      {
        needId: "need-1",
        quantity: 10,
        unit: "L",
        proofType: "PHOTO_GEO",
        beneficiaryAcknowledgment: "anonymous receipt",
        actor: "VOL-1",
        idempotencyKey: "dist-key-1",
      },
      registry,
    );
    expect(refused.success).toBe(false);

    const minimal = confirmDistributionSafely(
      {
        stock: makeStock({ physical: 100, reserved: 10, available: 90 }),
        needId: "need-1",
        quantity: 10,
        unit: "L",
        proofType: "MINIMAL_ATTESTATION",
        beneficiaryAcknowledgment: "anonymous receipt",
        actor: "VOL-1",
        idempotencyKey: "dist-key-2",
      },
      registry,
    );
    expect(minimal.success).toBe(true);
    expect(minimal.updatedStock?.physical).toBe(90);
  });

  it("eliminates unavailable volunteers at stage 1", () => {
    const volunteer: VolunteerCapacity = {
      id: "vol-1",
      refOpaque: "VOL-OPAQUE-1",
      skillsDeclared: ["FIRST_AID"],
      skillsVerified: ["FIRST_AID"],
      availability: "UNAVAILABLE",
      mobility: "OFFROAD_4X4",
      operationalRestrictions: [],
      currentActiveMissionsCount: 0,
      maxMissionsPerWeek: 5,
      briefedCrisisTypes: ["wildfire"],
    };
    const result = matchVolunteerForMission(volunteer, { crisisType: "wildfire", difficulty: "offroad_4x4" });
    expect(result.eligible).toBe(false);
    expect(result.eliminationReasons.length).toBeGreaterThan(0);
  });

  it("proposes hub rerouting above the saturation threshold", () => {
    const out = detectHubSaturation([
      { id: "h1", name: "Hub 1", capacityPercent: 88, location: { latitude: 36.77, longitude: 5.89 } },
      { id: "h2", name: "Hub 2", capacityPercent: 42, location: { latitude: 36.82, longitude: 5.76 } },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].rerouteHubId).toBe("h2");
  });

  it("builds versioned HXL rows without PII", () => {
    const rows = buildHxlRows("Jijel Wildfire", [
      {
        wilayaCode: "18",
        commune: "Taher",
        type: "WATER",
        title: "Drinking water",
        unit: "L",
        requested: 1000,
        distributed: 200,
        status: "OPEN",
        reportedAt: "2026-10-09T08:45:00Z",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].coveragePct).toBe(20);
    expect(HXL_HEADER).toContain("#indicator+num+needed");
    expect(JSON.stringify(rows)).not.toMatch(/0550|Boumaza/i);
  });

  it("canonicalises JSON deterministically and hashes with real SHA-256", () => {
    expect(canonicalizeJson({ b: 1, a: 2 })).toBe(canonicalizeJson({ a: 2, b: 1 }));
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("pseudonymises beneficiaries with HMAC, never raw identity", () => {
    const h1 = computeBeneficiaryHmac("inc-1", "Taher", 5, "wildfire");
    const h2 = computeBeneficiaryHmac("inc-1", "Taher", 5, "wildfire");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^BENEF-[0-9A-F]{12}$/);
    expect(h1).not.toContain("Taher");
  });
});
