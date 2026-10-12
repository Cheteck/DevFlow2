import { describe, it, expect } from "vitest";
import { CitadellePolicyEvaluator } from "./domain/citadelle-policy.js";

describe("BOUND-07 — Citadelle Identity vs Domain Role Boundary", () => {
  const evaluator = new CitadellePolicyEvaluator();

  it("permits native identity roles (citizen, member, admin)", () => {
    const res = evaluator.evaluate({
      userId: "usr_1",
      requestedRoles: ["citizen", "member"],
    });

    expect(res.allowed).toBe(true);
    expect(res.permittedRoles).toEqual(["citizen", "member"]);
    expect(res.rejectedRoles).toHaveLength(0);
  });

  it("rejects domain business roles without ADR (merchant, delivery_partner)", () => {
    const res = evaluator.evaluate({
      userId: "usr_2",
      requestedRoles: ["member", "merchant", "delivery_partner"],
    });

    expect(res.allowed).toBe(false);
    expect(res.permittedRoles).toEqual(["member"]);
    expect(res.rejectedRoles).toEqual(["merchant", "delivery_partner"]);
    expect(res.reason).toContain("granted by domain BACs");
  });
});
