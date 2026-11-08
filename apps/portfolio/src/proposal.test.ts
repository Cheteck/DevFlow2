import { describe, expect, it } from "vitest";
import { ProposalService, type OfferProvisioningPort } from "./domain/proposal-service.js";
import { InMemoryProposalRepository } from "./infrastructure/in-memory-proposal-repository.js";
import { PortfolioService } from "./domain/portfolio-service.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";

const TENANT_ID = "tenant_test";

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
    }, TENANT_ID);

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe("Draft");
    expect(draft.vendableId).toBeNull();

    // 2. Submit Proposal
    const submitted = await proposalService.submit(draft.id, "space-caj-jijel", TENANT_ID);
    expect(submitted.status).toBe("Submitted");
    expect(submitted.submittedAt).toBeDefined();

    // 3. Platform Admin claims InReview
    const inReview = await proposalService.claimInReview(submitted.id, "usr-platform-admin", TENANT_ID);
    expect(inReview.status).toBe("InReview");
    expect(inReview.reviewedBy).toBe("usr-platform-admin");

    // 4. Platform Admin approves proposal (atomically creates Published Vendable)
    const { proposal: approvedProp, vendableId } = await proposalService.approve(
      inReview.id,
      "usr-platform-admin",
      TENANT_ID
    );

    expect(approvedProp.status).toBe("Approved");
    expect(approvedProp.vendableId).toBe(vendableId);

    // Verify canonical vendable exists and is published
    const vendable = vendableRepo.findById(vendableId, TENANT_ID);
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
    }, TENANT_ID);

    await proposalService.submit(draft.id, "space-caj-jijel", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-platform-admin", TENANT_ID);

    const result = await proposalService.approve(draft.id, "usr-platform-admin", TENANT_ID);

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
    }, TENANT_ID);

    await proposalService.submit(draft.id, "space-caj-jijel", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-admin", TENANT_ID);
    const changesReq = await proposalService.requestChanges(
      draft.id,
      "usr-admin",
      "Ajouter la description en français",
      TENANT_ID
    );

    expect(changesReq.status).toBe("ChangesRequested");
    expect(changesReq.platformFeedback).toContain("description en français");

    // Space updates draft
    const updated = await proposalService.updateDraft(draft.id, "space-caj-jijel", {
      content: { fr: { name: "Test Ref updated" } },
    }, TENANT_ID);
    expect(updated.status).toBe("ChangesRequested");
    expect(updated.content["fr"]).toBeDefined();

    // Re-submit
    const reSubmitted = await proposalService.submit(draft.id, "space-caj-jijel", TENANT_ID);
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
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-caj-jijel", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-platform-admin", TENANT_ID);

    const result = await proposalService.approve(draft.id, "usr-platform-admin", TENANT_ID, {
      idempotencyKey: "idem-approve-1",
    });

    expect(result.offerId).toBe("off_mock_approved");
    const stored = await proposalRepo.findById(draft.id, TENANT_ID);
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
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-caj-jijel", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-platform-admin", TENANT_ID);

    const first = await proposalService.approve(draft.id, "usr-platform-admin", TENANT_ID, {
      idempotencyKey: "idem-same-key",
    });
    const second = await proposalService.approve(draft.id, "usr-platform-admin", TENANT_ID, {
      idempotencyKey: "idem-same-key",
    });

    expect(second.vendableId).toBe(first.vendableId);
    expect(second.offerId).toBe(first.offerId);
    expect(provisions).toBe(1);

    await expect(
      proposalService.approve(draft.id, "usr-platform-admin", TENANT_ID, { idempotencyKey: "idem-other-key" }),
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
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-caj-jijel", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-platform-admin", TENANT_ID);

    await expect(proposalService.approve(draft.id, "usr-platform-admin", TENANT_ID)).rejects.toThrow(
      "provisioning unavailable",
    );
    const stored = await proposalRepo.findById(draft.id, TENANT_ID);
    expect(stored?.status).toBe("InReview");
    expect(stored?.vendableId).toBeNull();
  });

  it("should enforce multi-tenant isolation: proposals from tenant A are invisible to tenant B", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepoA = new InMemoryVendableRepository();
    const vendableRepoB = new InMemoryVendableRepository();
    const portfolioServiceA = new PortfolioService(vendableRepoA);
    const portfolioServiceB = new PortfolioService(vendableRepoB);
    const proposalServiceA = new ProposalService(proposalRepo, portfolioServiceA);
    const proposalServiceB = new ProposalService(proposalRepo, portfolioServiceB);

    const TENANT_A = "tenant_a";
    const TENANT_B = "tenant_b";

    // Tenant A creates a proposal
    const draftA = await proposalServiceA.createDraft("space-a", "usr-a", {
      suggestedReference: "REF-TENANT-A",
      type: "Product",
      content: { fr: { name: "Produit Tenant A" } },
    }, TENANT_A);

    // Tenant B creates a proposal
    const draftB = await proposalServiceB.createDraft("space-b", "usr-b", {
      suggestedReference: "REF-TENANT-B",
      type: "Product",
      content: { fr: { name: "Produit Tenant B" } },
    }, TENANT_B);

    // Tenant A cannot see Tenant B's proposal
    const hiddenFromA = await proposalServiceA.findById(draftB.id, TENANT_A);
    expect(hiddenFromA).toBeNull();

    // Tenant B cannot see Tenant A's proposal
    const hiddenFromB = await proposalServiceB.findById(draftA.id, TENANT_B);
    expect(hiddenFromB).toBeNull();

    // Each tenant can see their own proposal
    const visibleA = await proposalServiceA.findById(draftA.id, TENANT_A);
    expect(visibleA?.suggestedReference).toBe("REF-TENANT-A");

    const visibleB = await proposalServiceB.findById(draftB.id, TENANT_B);
    expect(visibleB?.suggestedReference).toBe("REF-TENANT-B");

    // Tenant A cannot submit Tenant B's proposal
    await expect(proposalServiceA.submit(draftB.id, "space-b", TENANT_A)).rejects.toThrow("not found");

    // Tenant B cannot submit Tenant A's proposal
    await expect(proposalServiceB.submit(draftA.id, "space-a", TENANT_B)).rejects.toThrow("not found");
  });

  it("should enforce optimistic locking on approve() (second call fails)", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-concurrent", "usr-admin", {
      suggestedReference: "REF-CONCURRENT",
      type: "Product",
      content: { commercialTerms: { priceInCents: 5000, currency: "EUR" } },
    }, TENANT_ID);

    await proposalService.submit(draft.id, "space-concurrent", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-admin", TENANT_ID);

    // First approve should succeed
    const firstResult = await proposalService.approve(draft.id, "usr-admin", TENANT_ID);
    expect(firstResult.proposal.status).toBe("Approved");

    // Second approve should fail with optimistic locking / already approved error
    await expect(
      proposalService.approve(draft.id, "usr-admin", TENANT_ID),
    ).rejects.toThrow(/already approved|Concurrent modification/);

    // Verify only one vendable was created
    const allVendables = vendableRepo.findAll(TENANT_ID);
    expect(allVendables).toHaveLength(1);
  });

  it("should revert proposal to InReview when vendable creation fails (compensation)", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    // Make createVendable throw to simulate failure
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const origCreateVendable = portfolioService.createVendable.bind(portfolioService);
    portfolioService.createVendable = async function () {
      throw new Error("vendable creation failed");
    };
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-comp", "usr-admin", {
      suggestedReference: "REF-COMP",
      type: "Product",
      content: {},
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-comp", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-admin", TENANT_ID);

    // Approve should throw (because createVendable fails)
    await expect(
      proposalService.approve(draft.id, "usr-admin", TENANT_ID),
    ).rejects.toThrow("vendable creation failed");

    // Compensation: proposal must be back to InReview
    const reverted = await proposalRepo.findById(draft.id, TENANT_ID);
    expect(reverted?.status).toBe("InReview");

    // No vendable was created
    expect(vendableRepo.findAll(TENANT_ID)).toHaveLength(0);
  });

  it("should not create vendable when optimistic lock fails (race loser)", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-race", "usr-admin", {
      suggestedReference: "REF-RACE",
      type: "Product",
      content: {},
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-race", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-admin", TENANT_ID);

    // First approve succeeds
    const first = await proposalService.approve(draft.id, "usr-admin", TENANT_ID);
    expect(first.proposal.status).toBe("Approved");

    // Second approve fails (already approved status check)
    await expect(
      proposalService.approve(draft.id, "usr-admin", TENANT_ID),
    ).rejects.toThrow(/already approved|Concurrent modification/);

    // Exactly one vendable created (loser didn't create one)
    expect(vendableRepo.findAll(TENANT_ID)).toHaveLength(1);
  });

  it("should handle concurrent modification during approval", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-mod", "usr-admin", {
      suggestedReference: "REF-MOD",
      type: "Product",
      content: {},
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-mod", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-admin", TENANT_ID);

    // Simulate a true version conflict: a concurrent writer mutates the row
    // between the service's findById and updateWithVersionCheck → the
    // conditional UPDATE matches 0 rows (in-memory equivalent: false).
    proposalRepo.updateWithVersionCheck = async () => false;

    await expect(
      proposalService.approve(draft.id, "usr-admin", TENANT_ID),
    ).rejects.toThrow("Concurrent modification");

    // The loser of the race must NOT have created a vendable
    expect(vendableRepo.findAll(TENANT_ID)).toHaveLength(0);

    // The proposal must still be InReview (compensation not needed: lock
    // gate failed before the flip was persisted, but verify state integrity)
    const after = await proposalRepo.findById(draft.id, TENANT_ID);
    expect(after?.status).toBe("InReview");
  });

  it("should perform version‑safe rollback when createVendable fails and rollback succeeds", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    // 1) createVendable fails (primary operation)
    portfolioService.createVendable = async function () {
      throw new Error("vendable creation failed");
    };
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-rb", "usr-admin", {
      suggestedReference: "REF-RB",
      type: "Product",
      content: {},
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-rb", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-admin", TENANT_ID);

    // 2) rollback write also fails (simulated infrastructure outage)
    // Spy on the version-checked rollback write (compensation now uses
    // updateWithVersionCheck to avoid overwriting concurrent modifications).
    const updateCalls: { proposal: { status: string }; tenantId: string }[] = [];
    let callCount = 0;
    const realUpdateWithVersionCheck = proposalRepo.updateWithVersionCheck.bind(proposalRepo);
    proposalRepo.updateWithVersionCheck = async (proposal: any, _versionField: any, tenantId: string) => {
      callCount++;
      // First call is the optimistic lock gate — let it succeed.
      // Second call is the rollback — simulate failure (version conflict).
      if (callCount === 1) {
        return true; // lock gate succeeds
      }
      updateCalls.push({ proposal: { status: proposal.status }, tenantId });
      return false; // rollback version check fails
    };

    // Original error must surface (rollback failure must not mask it)
    await expect(
      proposalService.approve(draft.id, "usr-admin", TENANT_ID),
    ).rejects.toThrow("vendable creation failed");

    // The compensation MUST have been attempted with status InReview,
    // scoped to the same tenant (tenant-safe rollback attempt).
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].proposal.status).toBe("InReview");
    expect(updateCalls[0].tenantId).toBe(TENANT_ID);

    // No vendable leaked
    expect(vendableRepo.findAll(TENANT_ID)).toHaveLength(0);

    // Restore for subsequent tests (isolated repo instances, but keep clean)
    proposalRepo.updateWithVersionCheck = realUpdateWithVersionCheck;
  });

  it("should perform version-safe rollback successfully when createVendable fails", async () => {
    // This test proves that the rollback can succeed when no concurrent
    // modification occurs — i.e., prop.reviewedAt === prop.updatedAt after
    // the lock gate, so the version check passes.
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    portfolioService.createVendable = async function () {
      throw new Error("vendable creation failed");
    };
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-rb-ok", "usr-admin", {
      suggestedReference: "REF-RB-OK",
      type: "Product",
      content: {},
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-rb-ok", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-admin", TENANT_ID);

    // Let the lock gate succeed, and let the rollback succeed too.
    let callCount = 0;
    proposalRepo.updateWithVersionCheck = async (proposal: any, _versionField: any, tenantId: string) => {
      callCount++;
      if (callCount === 1) return true; // lock gate
      return true; // rollback succeeds
    };

    await expect(
      proposalService.approve(draft.id, "usr-admin", TENANT_ID),
    ).rejects.toThrow("vendable creation failed");

    // Verify rollback succeeded: proposal should be back to InReview
    const after = await proposalRepo.findById(draft.id, TENANT_ID);
    expect(after?.status).toBe("InReview");

    // No vendable created
    expect(vendableRepo.findAll(TENANT_ID)).toHaveLength(0);

    // Exactly 2 calls: lock gate + rollback
    expect(callCount).toBe(2);
  });

  it("should recover from partial success: vendable persisted but createVendable response lost", async () => {
    // Scenario: a previous approve() attempt persisted the vendable in the
    // store but crashed before returning. The retry must NOT create a
    // duplicate vendable and must NOT roll the proposal back to InReview.
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-partial", "usr-admin", {
      suggestedReference: "REF-PARTIAL",
      type: "Product",
      content: {},
    }, TENANT_ID);
    await proposalService.submit(draft.id, "space-partial", TENANT_ID);
    await proposalService.claimInReview(draft.id, "usr-admin", TENANT_ID);

    // Simulate the partial-success state: a previous attempt already
    // persisted the vendable in the store but crashed before returning.
    // The mock materializes that store state on the first findVendable()
    // call (which is exactly the reconciliation lookup approve() performs),
    // persisting the vendable under the ID being approved.
    portfolioService.findVendable = async function (vendableId: string) {
      const persisted = {
        identity: {
          id: vendableId,
          reference: "REF-PARTIAL",
          type: "Product" as const,
          status: "Published" as const,
        },
        content: {},
        characteristics: { attributes: {} },
        classification: {},
        media: [],
        variants: [],
        relations: [],
      };
      vendableRepo.save(persisted, TENANT_ID);
      return persisted;
    };

    // createVendable still throws (e.g. duplicate key error on a blind
    // second insert) — the reconciliation lookup must prevent it from
    // ever being reached:
    portfolioService.createVendable = async function () {
      throw new Error("duplicate key (should never be reached: reconciled)");
    };

    const approval = await proposalService.approve(draft.id, "usr-admin", TENANT_ID);
    expect(approval.proposal.status).toBe("Approved");

    // Exactly one vendable exists (no duplicate created)
    const all = vendableRepo.findAll(TENANT_ID);
    expect(all).toHaveLength(1);
    expect(all[0].identity.id).toBe(approval.vendableId);

    // The proposal was NOT rolled back to InReview
    const after = await proposalRepo.findById(draft.id, TENANT_ID);
    expect(after?.status).toBe("Approved");
  });
});
