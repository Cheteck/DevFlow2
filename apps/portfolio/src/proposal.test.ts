import { describe, expect, it } from "vitest";
import { ProposalService, type OfferProvisioningPort } from "./domain/proposal-service.js";
import { InMemoryProposalRepository } from "./infrastructure/in-memory-proposal-repository.js";
import { PortfolioService } from "./domain/portfolio-service.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";

/* AUDIT-RESET a055b8e (2026-10-13) — DELTA DE SESSION ABSENT PUIS RESTAURÉ (V1.2, voir git log).
 * Cas lifecycle + provision hérités de 0022dd6 ; cas persistance/replay/échec ajoutés ci-dessous. */

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

  it("should provision commercial offer atomically when OfferProvisioningPort is supplied (SELL-FLOW-01)", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);

    let provisionedInput: unknown = null;
    const mockOfferPort: OfferProvisioningPort = {
      async provisionOffer(input) {
        provisionedInput = input;
        return { offerId: "off_mock_123" };
      },
    };

    const proposalService = new ProposalService(proposalRepo, portfolioService, mockOfferPort);

    const draft = await proposalService.createDraft("space-caj-jijel", "usr-space-admin", {
      suggestedReference: "XIAOMI-COMMERCIAL",
      type: "Product",
      content: {
        fr: { name: "Xiaomi 18 Commercial Edition" },
        commercialTerms: { priceInCents: 99900, currency: "EUR" },
      },
    });

    await proposalService.submit(draft.id, "space-caj-jijel");
    await proposalService.claimInReview(draft.id, "usr-platform-admin");

    const result = await proposalService.approve(draft.id, "usr-platform-admin");

    expect(result.offerId).toBe("off_mock_123");
    expect(provisionedInput).toEqual({
      vendableId: result.vendableId,
      sellerSpaceId: "space-caj-jijel",
      sellerUserId: "usr-space-admin",
      commercialTerms: { priceInCents: 99900, currency: "EUR" },
    });
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

  it("should persist approvedTerms, auditTrail and idempotencyKey on approval (SELL-FLOW-01 restore)", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalService = new ProposalService(proposalRepo, portfolioService, {
      async provisionOffer() {
        return { offerId: "off_mock_approved" };
      },
    });

    const draft = await proposalService.createDraft("space-caj-jijel", "usr-space-admin", {
      suggestedReference: "XIAOMI-TERMS",
      type: "Product",
      content: { commercialTerms: { priceInCents: 49900, currency: "EUR" } },
    });
    await proposalService.submit(draft.id, "space-caj-jijel");
    await proposalService.claimInReview(draft.id, "usr-platform-admin");

    const result = await proposalService.approve(draft.id, "usr-platform-admin", {
      idempotencyKey: "idem-approve-1",
    });

    expect(result.offerId).toBe("off_mock_approved");
    const stored = await proposalRepo.findById(draft.id);
    expect(stored?.approvedTerms).toEqual({ priceInCents: 49900, currency: "EUR" });
    expect(stored?.approvedOfferId).toBe("off_mock_approved");
    expect(stored?.idempotencyKey).toBe("idem-approve-1");
    expect(stored?.auditTrail.map((e) => e.action)).toEqual([
      "created",
      "submitted",
      "claimed_in_review",
      "approved",
    ]);
  });

  it("should replay approval idempotently without duplicating vendable or offer", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    let provisions = 0;
    const proposalService = new ProposalService(proposalRepo, portfolioService, {
      async provisionOffer() {
        provisions += 1;
        return { offerId: `off_mock_${provisions}` };
      },
    });

    const draft = await proposalService.createDraft("space-caj-jijel", "usr-space-admin", {
      suggestedReference: "XIAOMI-IDEM",
      type: "Product",
      content: { commercialTerms: { priceInCents: 1000, currency: "EUR" } },
    });
    await proposalService.submit(draft.id, "space-caj-jijel");
    await proposalService.claimInReview(draft.id, "usr-platform-admin");

    const first = await proposalService.approve(draft.id, "usr-platform-admin", {
      idempotencyKey: "idem-same-key",
    });
    const second = await proposalService.approve(draft.id, "usr-platform-admin", {
      idempotencyKey: "idem-same-key",
    });

    expect(second.vendableId).toBe(first.vendableId);
    expect(second.offerId).toBe(first.offerId);
    expect(provisions).toBe(1);

    await expect(
      proposalService.approve(draft.id, "usr-platform-admin", { idempotencyKey: "idem-other-key" }),
    ).rejects.toThrow("already approved");
  });

  it("should keep the proposal InReview when offer provisioning fails", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalService = new ProposalService(proposalRepo, portfolioService, {
      async provisionOffer() {
        throw new Error("provisioning unavailable");
      },
    });

    const draft = await proposalService.createDraft("space-caj-jijel", "usr-space-admin", {
      suggestedReference: "XIAOMI-FAIL",
      type: "Product",
      content: { commercialTerms: { priceInCents: 1000, currency: "EUR" } },
    });
    await proposalService.submit(draft.id, "space-caj-jijel");
    await proposalService.claimInReview(draft.id, "usr-platform-admin");

    await expect(proposalService.approve(draft.id, "usr-platform-admin")).rejects.toThrow(
      "provisioning unavailable",
    );
    const stored = await proposalRepo.findById(draft.id);
    expect(stored?.status).toBe("InReview");
    expect(stored?.vendableId).toBeNull();
  });
});
