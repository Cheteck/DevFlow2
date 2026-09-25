import type { Proposal } from "./proposal.js";
import type { ProposalRepository } from "./proposal-repository.js";
import type { PortfolioService } from "./portfolio-service.js";
import { uuidV7 } from "@mosaix/types";

export class ProposalService {
  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly portfolioService: PortfolioService
  ) {}

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
      createdAt: now,
      updatedAt: now,
    };

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

    await this.proposalRepository.update(prop);
    return prop;
  }

  async approve(id: string, reviewerUserId: string): Promise<{ proposal: Proposal; vendableId: string }> {
    const prop = await this.proposalRepository.findById(id);
    if (!prop) throw new Error(`Proposal ${id} not found`);
    if (prop.status !== "InReview") throw new Error(`Proposal must be InReview to be approved`);

    // Create the canonical published Vendable via PortfolioService
    const createdVendable = await this.portfolioService.createVendable({
      identity: {
        id: `vendable_${uuidV7()}`,
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
    prop.reviewedBy = reviewerUserId;
    prop.reviewedAt = new Date().toISOString();
    prop.updatedAt = prop.reviewedAt;

    await this.proposalRepository.update(prop);
    return { proposal: prop, vendableId: createdVendable.identity.id };
  }
}
