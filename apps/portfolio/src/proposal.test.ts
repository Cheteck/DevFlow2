import { describe, expect, it } from "vitest";
import { ProposalService } from "./domain/proposal-service.js";
import { InMemoryProposalRepository } from "./infrastructure/in-memory-proposal-repository.js";
import { PortfolioService } from "./domain/portfolio-service.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";

describe("Portfolio Proposal Workflow (PRD-0010)", () => {
  it("should handle proposal lifecycle: Draft -> Submitted -> InReview -> Approved -> Vendable Published", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    // 1. Create Draft by Space Admin
    const draft = await proposalService.createDraft("space-caj-jijel", "usr-space-admin", {
      suggestedReference: "XIAOMI-18-PRO-MAX",
      type: "Product",
      content: { fr: { name: "Xiaomi 18 Pro Max 5G" } },
      characteristics: { brand: "Xiaomi" },
    });

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe("Draft");
    expect(draft.vendableId).toBeNull();

    // 2. Submit Proposal
    const submitted = await proposalService.submit(draft.id, "space-caj-jijel");
    expect(submitted.status).toBe("Submitted");
    expect(submitted.submittedAt).toBeDefined();

    // 3. Platform Admin claims InReview
    const inReview = await proposalService.claimInReview(submitted.id, "usr-platform-admin");
    expect(inReview.status).toBe("InReview");
    expect(inReview.reviewedBy).toBe("usr-platform-admin");

    // 4. Platform Admin approves proposal (atomically creates Published Vendable)
    const { proposal: approvedProp, vendableId } = await proposalService.approve(
      inReview.id,
      "usr-platform-admin"
    );

    expect(approvedProp.status).toBe("Approved");
    expect(approvedProp.vendableId).toBe(vendableId);

    // Verify canonical vendable exists and is published
    const vendable = vendableRepo.findById(vendableId);
    expect(vendable).toBeDefined();
    expect(vendable?.identity.status).toBe("Published");
    expect(vendable?.identity.reference).toBe("XIAOMI-18-PRO-MAX");
  });

  it("should handle ChangesRequested workflow", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-caj-jijel", "usr-space-admin", {
      suggestedReference: "TEST-REF",
      type: "Product",
    });

    await proposalService.submit(draft.id, "space-caj-jijel");
    await proposalService.claimInReview(draft.id, "usr-admin");
    const changesReq = await proposalService.requestChanges(
      draft.id,
      "usr-admin",
      "Ajouter la description en français"
    );

    expect(changesReq.status).toBe("ChangesRequested");
    expect(changesReq.platformFeedback).toContain("description en français");

    // Space updates draft
    const updated = await proposalService.updateDraft(draft.id, "space-caj-jijel", {
      content: { fr: { name: "Test Ref updated" } },
    });
    expect(updated.status).toBe("ChangesRequested");
    expect(updated.content["fr"]).toBeDefined();

    // Re-submit
    const reSubmitted = await proposalService.submit(draft.id, "space-caj-jijel");
    expect(reSubmitted.status).toBe("Submitted");
  });
});
