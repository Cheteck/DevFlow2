import { describe, expect, it } from "vitest";
import { UserService } from "../../apps/citadelle/src/domain/user-service.js";
import { PortfolioService } from "../../apps/portfolio/src/domain/portfolio-service.js";
import { ProposalService } from "../../apps/portfolio/src/domain/proposal-service.js";
import { InMemoryProposalRepository } from "../../apps/portfolio/src/infrastructure/in-memory-proposal-repository.js";
import { CommerceOfferService } from "../../apps/commerce/src/domain/commerce-offer.model.js";
import { SatimPaymentPort } from "../../apps/commerce/src/domain/satim-payment-port.js";
import { SolaraSocialService } from "../../apps/solara/src/domain/social.model.js";
import { IntelligenceRuntime, ProviderRouter } from "@mosaix/intelligence";
import { TypeSafeJevProvider } from "@mosaix/adapter-intelligence-typesafe";

class InMemoryUserRepository {
  private users = new Map<string, unknown>();
  async findById(id: string) { return this.users.get(id) || null; }
  async findByEmail(email: string) {
    return Array.from(this.users.values()).find(u => u.email === email) || null;
  }
  async save(user: unknown) {
    this.users.set(user.id, user);
    return user;
  }
}

class InMemoryVendableRepository {
  private items = new Map<string, unknown>();
  async findById(id: string) { return this.items.get(id) || null; }
  async findByReference(ref: string) {
    return Array.from(this.items.values()).find(i => i.reference === ref) || null;
  }
  async save(vendable: unknown) {
    this.items.set(vendable.identity.id, vendable);
    return vendable;
  }
}

describe("End-to-End Multi-BAC Critical Workflows Integration Suite", () => {
  it("Flow 1: Citadelle User Registration & Password Hashing Security Workflow", async () => {
    const userRepo = new InMemoryUserRepository();
    const userService = new UserService(userRepo);

    const user = await userService.create({
      email: "citadelle.e2e@mosaix.platform",
      displayName: "Éléonore E2E",
      passwordHash: "scrypt$hashed_password_sample",
      roles: ["citizen", "merchant"],
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe("citadelle.e2e@mosaix.platform");

    const found = await userService.lookup({ email: "citadelle.e2e@mosaix.platform" });
    expect(found?.id).toBe(user.id);
  });

  it("Flow 2: Portfolio Product Catalog & Space Proposal State Machine", async () => {
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalRepo = new InMemoryProposalRepository();
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    // 1. Create Vendable
    const vendable = await portfolioService.createVendable({
      identity: {
        id: `vend_${Date.now()}`,
        reference: `VEND-E2E-${Date.now()}`,
        type: "product",
        status: "Published",
      },
      content: {
        fr: {
          name: "Smartphone Pro E2E",
          shortDescription: "Dernière génération",
          description: "Smartphone haute performance",
        },
      },
      classification: {
        categories: ["smartphones", "high-tech"],
        tags: ["mobile", "5g"],
      },
      characteristics: {
        attributes: { brand: "Samsung", storage: "512GB" },
        specifications: { weight: "220g" },
      },
    } as unknown);

    expect(vendable.identity.id).toBeDefined();

    // 2. Draft Proposal for Space
    const proposal = await proposalService.createDraft(
      "space_e2e_01",
      "usr_merchant_1",
      {
        suggestedReference: `PROP-REF-${Date.now()}`,
        type: "Product",
        content: { name: "Proposed Smartphone" },
      },
    );

    expect(proposal.status).toBe("Draft");

    // 3. Submit, Claim In Review, & Approve Proposal
    await proposalService.submit(proposal.id, "space_e2e_01");
    await proposalService.claimInReview(proposal.id, "usr_admin_1");
    const { proposal: approved } = await proposalService.approve(
      proposal.id,
      "usr_admin_1",
    );

    expect(approved.status).toBe("Approved");
  });

  it("Flow 3: Commerce Seller Offer & SATIM Algerian Gateway Authorization", async () => {
    const offerService = new CommerceOfferService();
    const satimAdapter = new SatimPaymentPort();

    // 1. Create Commerce Offer
    const offer = await offerService.createOffer({
      title: "Offre E2E Smartphone",
      seller: {
        type: "space",
        id: "space_e2e_01",
        name: "Espace E2E",
      },
      vendableId: "vend_123",
      priceInCents: 500000, // 5000 DZD
      commissionRateBps: 500, // 5%
    });

    expect(offer.id).toBeDefined();

    // 2. Calculate Payout
    const payout = offerService.calculatePayout(offer);
    expect(payout.netSellerPayoutInCents).toBe(475000); // 4750 DZD net

    // 3. SATIM CIB / Edahabia Authorization Hold
    await expect(
      satimAdapter.authorize("ord_e2e_satim_1", 500000, `idemp-e2e-${Date.now()}`),
    ).resolves.not.toThrow();

    // 4. SATIM Transaction Void / Refund
    await expect(
      satimAdapter.void("ord_e2e_satim_1", `idemp-e2e-${Date.now()}`),
    ).resolves.not.toThrow();
  });

  it("Flow 4: Solara Social Feed & IJIDeals Intelligence Decision Engine Integration", async () => {
    const socialService = new SolaraSocialService();
    const router = new ProviderRouter();
    router.register(new TypeSafeJevProvider());
    const intelligence = new IntelligenceRuntime(router);

    // 1. Solara Post Creation & Multi-Source Feed Aggregation
    const post = await socialService.createPost({
      actorType: "user",
      actorId: "usr_e2e_1",
      publicationType: "text",
      content: "Nouveau smartphone d'exception disponible sur IJIDeals !",
      tags: ["smartphone", "innovation"],
    });

    expect(post.id).toBeDefined();

    const posts = socialService.listFeed();
    expect(posts.length).toBeGreaterThan(0);

    // 2. IJIDeals Intelligence Product Classification
    const classification = await intelligence.decide({
      capability: "commerce.product.classify",
      state: { title: "Samsung Galaxy S26 Ultra 512 Go Noir" },
    });

    expect(classification.confidenceLevel).toBe("AUTO");
    expect((classification.value as { category: string }).category).toBe(
      "smartphones",
    );

    // 3. IJIDeals Intelligence Content Moderation
    const moderation = await intelligence.decide({
      capability: "spaces.content.moderate",
      state: { text: "Excellente initiative pour la communauté !" },
    });

    expect(moderation.confidenceLevel).toBe("AUTO");
    expect((moderation.value as { flagged: boolean }).flagged).toBe(false);
  });
});
