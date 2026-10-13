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
    }
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

    await this.proposalRepository.save(proposal);
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
    }
  ): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id);
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

    await this.proposalRepository.update(prop);
    return prop;
  }

  async submit(id: string, spaceId: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.spaceId !== spaceId) throw new Error("Unauthorized space access");
    if (prop.status !== "Draft" && prop.status !== "ChangesRequested") {
      throw new Error(`Cannot submit proposal in status ${prop.status}`);
    }

    prop.status = "Submitted";
    prop.submittedAt = new Date().toISOString();
    prop.updatedAt = prop.submittedAt;
    this.appendTrail(prop, spaceId, "submitted");

    await this.proposalRepository.update(prop);
    return prop;
  }

  async claimInReview(id: string, reviewerUserId: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.status !== "Submitted" && prop.status !== "InReview") {
      throw new Error(`Cannot claim proposal in status ${prop.status}`);
    }

    prop.status = "InReview";
    prop.reviewedBy = reviewerUserId;
    prop.reviewStartedAt = new Date().toISOString();
    prop.updatedAt = prop.reviewStartedAt;
    this.appendTrail(prop, reviewerUserId, "claimed_in_review");

    await this.proposalRepository.update(prop);
    return prop;
  }

  async requestChanges(id: string, reviewerUserId: string, feedback: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.status !== "InReview") throw new Error(`Proposal must be InReview to request changes`);

    prop.status = "ChangesRequested";
    prop.platformFeedback = feedback;
    prop.reviewedBy = reviewerUserId;
    prop.reviewedAt = new Date().toISOString();
    prop.updatedAt = prop.reviewedAt;
    this.appendTrail(prop, reviewerUserId, "changes_requested", feedback);

    await this.proposalRepository.update(prop);
    return prop;
  }

  async reject(id: string, reviewerUserId: string, reason: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id);
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

    await this.proposalRepository.update(prop);
    return prop;
  }

  async withdraw(id: string, spaceId: string): Promise<Proposal> {
    const prop = await this.proposalRepository.findById(id);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.spaceId !== spaceId) throw new Error("Unauthorized space access");
    if (!["Draft", "Submitted", "ChangesRequested"].includes(prop.status)) {
      throw new Error(`Cannot withdraw proposal in status ${prop.status}`);
    }

    prop.status = "Withdrawn";
    prop.updatedAt = new Date().toISOString();
    this.appendTrail(prop, spaceId, "withdrawn");

    await this.proposalRepository.update(prop);
    return prop;
  }

  /* AUDIT-RESET a055b8e (2026-10-13) — PERTE PARTIELLE CONFIRMÉE PUIS RESTAURÉE (V1.2, voir git log).
   * approve() ne persistait qu'offerId (0022dd6) ; approvedTerms/auditTrail/idempotence restaurés
   * ci-dessus (champs + trail append-only + replay idempotent). Ancien commentaire remplacé. */
  async approve(
    id: string,
    reviewerUserId: string,
    options?: {
      /** Commercial terms frozen at approval (defaults to content.commercialTerms). */
      approvedTerms?: Record<string, unknown>;
      /** Idempotence key: replay with the same key returns the original approval. */
      idempotencyKey?: string;
    },
  ): Promise<{ proposal: Proposal; vendableId: string; offerId?: string }> {
    const prop = await this.proposalRepository.findById(id);
    if (!prop) throw new Error(`Proposal ${id} not found`);

    // Idempotent replay: same key on an approved proposal returns the original
    // outcome instead of creating a second vendable/offer.
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

    // Atomicity order: provision the commercial offer BEFORE creating the canonical
    // vendable, so a provisioning failure leaves no orphan published vendable behind.
    // (A vendable-creation failure after a successful provisioning may leave an orphan
    // offer instead — external side effect, surfaced to the reviewer via the thrown error.)
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

    // Create the canonical published Vendable via PortfolioService
    const createdVendable = await this.portfolioService.createVendable({
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
    });

    prop.status = "Approved";
    prop.vendableId = createdVendable.identity.id;
    prop.approvedTerms = approvedTerms;
    prop.approvedOfferId = provisionedOfferId ?? null;
    prop.idempotencyKey = options?.idempotencyKey ?? null;
    prop.reviewedBy = reviewerUserId;
    prop.reviewedAt = new Date().toISOString();
    prop.updatedAt = prop.reviewedAt;
    this.appendTrail(prop, reviewerUserId, "approved");

    await this.proposalRepository.update(prop);
    return { proposal: prop, vendableId: createdVendable.identity.id, offerId: provisionedOfferId };
  }
}
