import * as crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { MerkleAuditTrail } from "../src/domain/solidarity-geospatial-matching.js";

describe("MerkleAuditTrail (§2.10 — integrity, not factual truth)", () => {
  it("hashes blocks with real SHA-256 (64 hex chars, independently recomputable)", () => {
    const trail = new MerkleAuditTrail();
    const block = trail.recordDistribution("dist-1", "BENEF-ABCDEF123456", 200, "attestation-1");
    expect(block.hash).toMatch(/^[0-9a-f]{64}$/);
    const recomputed = crypto
      .createHash("sha256")
      .update(
        `${block.index}|${block.distributionId}|${block.recipientId}|${block.quantity}|${block.proofKey}|${block.previousHash}|${block.timestamp}`,
        "utf8",
      )
      .digest("hex");
    expect(block.hash).toBe(recomputed);
  });

  it("detects chain tampering", () => {
    const trail = new MerkleAuditTrail();
    trail.recordDistribution("dist-1", "BENEF-ABCDEF123456", 200, "attestation-1");
    expect(trail.verifyChain()).toBe(true);
    const blocks = (trail as unknown as { chain: Array<{ quantity: number }> }).chain;
    blocks[1].quantity = 9999;
    expect(trail.verifyChain()).toBe(false);
  });
});
