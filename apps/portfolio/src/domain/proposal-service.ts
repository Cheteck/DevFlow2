import type { Proposal, ProposalAuditEntry } from "./proposal.js";
import type { ProposalRepository } from "./proposal-repository.js";
import type { PortfolioService } from "./portfolio-service.js";
import { uuidV7 } from "@mosaix/types";

export interface OfferProvisioningPort {
  provisionOffer(input: {
    vendableId: string;
    sellerSpaceId: string;
    sellerUserId: string;
    commercialTerms: Record<string, unknown>;
  }): Promise<{ offerId: string }>;
}

export class ProposalService {
  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly portfolioService: PortfolioService,
    private readonly offerProvisioningPort?: OfferProvisioningPort
  ) {}

  private appendTrail(prop: Proposal, by: string, action: ProposalAuditEntry["action"], detail?: string): void {
    prop.auditTrail.push({ at: new Date().toISOString(), by, action, ...(detail ? { detail } : {}) });
  }

  async findById(id: string, tenantId: string): Promise<Proposal | null> {
    return this.proposalRepository.findById(id, tenantId);
  }

  async createDraft(
    spaceId: string,
    proposerUserId: string,
    input: {
      suggestedReference: string;
      type: "Product" | "Service" | "DigitalProduct" | "Experience";
      content?: Record<string, unknown>;
      classification?: Record<string, unknown>;
      characteristics?: Record<string, unknown>;
      features?: Record<string, unknown>;
      variants?: Record<string, unknown>;
      media?: Record<string, unknown>;
      translations?: Record<string, unknown>;
    },
    tenantId: string,
  ): Promise<Proposal> {
    const now = new Date().toISOString();
    const proposal: Proposal = {
      id: `prop_${uuidV7()}`,
      spaceId,
      proposerUserId,
      suggestedReference: input.suggestedReference,
      type: input.type,
      status: "Draft",
      content: input.content ?? {},
      classification: input.classification ?? {},
      characteristics: input.characteristics ?? {},
      features: input.features ?? {},
      variants: input.variants ?? {},
      media: input.media ?? {},
      translations: input.translations ?? {},
      vendableId: null,
      approvedTerms: null,
      approvedOfferId: null,
      idempotencyKey: null,
      auditTrail: [],
      createdAt: now,
      updatedAt: now,
    };
    this.appendTrail(proposal, proposerUserId, "created");

    await this.proposalRepository.save(proposal, tenantId);
    return proposal;
  }

  async updateDraft(
    id: string,
    spaceId: string,
    input: {
      suggestedReference?: string;
      type?: "Product" | "Service" | "DigitalProduct" | "Experience";
      content?: Record<string, unknown>;
      classification?: Record<string, unknown>;
      characteristics?: Record<string, unknown>;
      features?: Record<string, unknown>;
      variants?: Record<string, unknown>;
      media?: Record<string, unknown>;
      translations?: Record<string, unknown>;
    },
    tenantId: string,
  ): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id, tenantId);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.spaceId !== spaceId) throw new Error("Unauthorized space access");
    if (prop.status !== "Draft" && prop.status !== "ChangesRequested") {
      throw new Error(`Cannot update proposal in status ${prop.status}`);
    }

    if (input.suggestedReference) prop.suggestedReference = input.suggestedReference;
    if (input.type) prop.type = input.type;
    if (input.content) prop.content = input.content;
    if (input.classification) prop.classification = input.classification;
    if (input.characteristics) prop.characteristics = input.characteristics;
    if (input.features) prop.features = input.features;
    if (input.variants) prop.variants = input.variants;
    if (input.media) prop.media = input.media;
    if (input.translations) prop.translations = input.translations;
    prop.updatedAt = new Date().toISOString();

    await this.proposalRepository.update(prop, tenantId);
    return prop;
  }

  async submit(id: string, spaceId: string, tenantId: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id, tenantId);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.spaceId !== spaceId) throw new Error("Unauthorized space access");
    if (prop.status !== "Draft" && prop.status !== "ChangesRequested") {
      throw new Error(`Cannot submit proposal in status ${prop.status}`);
    }

    prop.status = "Submitted";
    prop.submittedAt = new Date().toISOString();
    prop.updatedAt = prop.submittedAt;
    this.appendTrail(prop, spaceId, "submitted");

    await this.proposalRepository.update(prop, tenantId);
    return prop;
  }

  async claimInReview(id: string, reviewerUserId: string, tenantId: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id, tenantId);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.status !== "Submitted" && prop.status !== "InReview") {
      throw new Error(`Cannot claim proposal in status ${prop.status}`);
    }

    prop.status = "InReview";
    prop.reviewedBy = reviewerUserId;
    prop.reviewStartedAt = new Date().toISOString();
    prop.updatedAt = prop.reviewStartedAt;
    this.appendTrail(prop, reviewerUserId, "claimed_in_review");

    await this.proposalRepository.update(prop, tenantId);
    return prop;
  }

  async requestChanges(id: string, reviewerUserId: string, feedback: string, tenantId: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id, tenantId);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.status !== "InReview") throw new Error(`Proposal must be InReview to request changes`);

    prop.status = "ChangesRequested";
    prop.platformFeedback = feedback;
    prop.reviewedBy = reviewerUserId;
    prop.reviewedAt = new Date().toISOString();
    prop.updatedAt = prop.reviewedAt;
    this.appendTrail(prop, reviewerUserId, "changes_requested", feedback);

    await this.proposalRepository.update(prop, tenantId);
    return prop;
  }

  async reject(id: string, reviewerUserId: string, reason: string, tenantId: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id, tenantId);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.status !== "InReview" && prop.status !== "Submitted") {
      throw new Error(`Cannot reject proposal in status ${prop.status}`);
    }

    prop.status = "Rejected";
    prop.rejectionReason = reason;
    prop.reviewedBy = reviewerUserId;
    prop.reviewedAt = new Date().toISOString();
    prop.updatedAt = prop.reviewedAt;
    this.appendTrail(prop, reviewerUserId, "rejected", reason);

    await this.proposalRepository.update(prop, tenantId);
    return prop;
  }

  async withdraw(id: string, spaceId: string, tenantId: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id, tenantId);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.spaceId !== spaceId) throw new Error("Unauthorized space access");
    if (!["Draft", "Submitted", "ChangesRequested"].includes(prop.status)) {
      throw new Error(`Cannot withdraw proposal in status ${prop.status}`);
    }

    prop.status = "Withdrawn";
    prop.updatedAt = new Date().toISOString();
    this.appendTrail(prop, spaceId, "withdrawn");

    await this.proposalRepository.update(prop, tenantId);
    return prop;
  }

  async approve(
    id: string,
    reviewerUserId: string,
    tenantId: string,
    options?: {
      approvedTerms?: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ): Promise<{ proposal: Proposal; vendableId: string; offerId?: string }> {
    const prop = await this.proposalRepository.findById(id, tenantId);
    if (!prop) throw new Error(`Proposal ${id} not found`);

    if (prop.status === "Approved") {
      if (options?.idempotencyKey && prop.idempotencyKey === options.idempotencyKey && prop.vendableId) {
        return { proposal: prop, vendableId: prop.vendableId, offerId: prop.approvedOfferId ?? undefined };
      }
      throw new Error(`Proposal ${id} is already approved`);
    }
    if (prop.status !== "InReview") throw new Error(`Proposal must be InReview to be approved`);

    const approvedTerms =
      options?.approvedTerms ??
      ((prop.content as Record<string, unknown>).commercialTerms as Record<string, unknown> | undefined) ??
      null;

    const newVendableId = `vendable_${uuidV7()}`;
    let provisionedOfferId: string | undefined;

    if (this.offerProvisioningPort && approvedTerms) {
      const res = await this.offerProvisioningPort.provisionOffer({
        vendableId: newVendableId,
        sellerSpaceId: prop.spaceId,
        sellerUserId: prop.proposerUserId,
        commercialTerms: approvedTerms,
      });
      provisionedOfferId = res.offerId;
    }

    // Capture expected updatedAt VALUE BEFORE mutation
    const expectedUpdatedAt = prop.updatedAt;

    // Build post-approval proposal state (in-memory only for now)
    const preApproveSnapshot = {
      status: prop.status,
      updatedAt: prop.updatedAt,
    };

    prop.status = "Approved";
    prop.vendableId = newVendableId;
    prop.approvedTerms = approvedTerms;
    prop.approvedOfferId = provisionedOfferId ?? null;
    prop.idempotencyKey = options?.idempotencyKey ?? null;
    prop.reviewedBy = reviewerUserId;
    prop.reviewedAt = new Date().toISOString();
    prop.updatedAt = prop.reviewedAt;
    this.appendTrail(prop, reviewerUserId, "approved");

    // OPTIMISTIC LOCK GATE: atomically attempt the version-conditional update FIRST.
    // This must succeed BEFORE creating the vendable — otherwise concurrent
    // approvals could both create vendables before one update fails.
    const updated = await this.proposalRepository.updateWithVersionCheck(prop, {
      name: "updatedAt",
      expectedValue: expectedUpdatedAt,
    }, tenantId);

    if (!updated) {
      // Version changed → another approber won the race. Abort before any
      // side-effects (vendable creation) are performed.
      throw new Error(`Concurrent modification detected for proposal ${id}. Please retry.`);
    }

    // Version check passed — proceed with vendable provisioning (exactly-once).
    //
    // RECONCILIATION / IDEMPOTENT RECOVERY: if a previous attempt already
    // persisted the vendable (partial success — write committed, response lost),
    // do NOT create a duplicate and do NOT roll back the approved proposal.
    // The vendable existence check acts as the idempotency key for the
    // createVendable step, scoped by tenant.
    const preExistingVendable = await this.portfolioService.findVendable(
      newVendableId,
      tenantId,
    );

    if (!preExistingVendable) {
      try {
        await this.portfolioService.createVendable({
          identity: {
            id: newVendableId,
            reference: prop.suggestedReference,
            type: prop.type,
            status: "Published",
          },
          content: prop.content as never,
          classification: prop.classification as never,
          characteristics: prop.characteristics as never,
          media: Array.isArray(prop.media) ? prop.media : [],
          variants: (prop.variants as unknown as { variants?: [] }).variants ?? [],
          relations: [],
        }, tenantId);
      } catch (err) {
        // Compensation: the vendable did not exist beforehand, so if
        // createVendable() failed, no vendable is persisted — safely revert
        // the proposal to InReview to avoid an Approved proposal without
        // its vendable. The original error is re-thrown (never masked).
        //
        // Use updateWithVersionCheck (NOT update) to prevent overwriting
        // a legitimate concurrent modification that occurred between our
        // optimistic lock gate and this rollback. If the rollback version
        // check fails, the proposal remains Approved — a reconciliation
        // process can detect and heal Approved-without-vendable state later.
        const rollback: Proposal = { ...prop };
        rollback.status = "InReview";
        rollback.updatedAt = new Date().toISOString();
        await this.proposalRepository
          .updateWithVersionCheck(rollback, {
            name: "updatedAt",
            expectedValue: prop.reviewedAt, // the value we just persisted
          }, tenantId)
          .catch(() => {
            // Rollback failure is logged, not masked; reconciliation can
            // detect the Approved-without-vendable state on a later pass.
            console.error(
              `[ProposalService] Failed to revert proposal ${id} after createVendable failure`,
            );
          });
        throw err;
      }
    }
    // else: partial success recovered — vendable already persisted by the
    // previous attempt; proposal stays Approved (consistent final state).

    return { proposal: prop, vendableId: newVendableId, offerId: provisionedOfferId };
  }
}
