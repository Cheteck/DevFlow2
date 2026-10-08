import { describe, expect, it } from "vitest";
import { UserService, User, UserRepository } from "../../apps/citadelle/src/domain/user-service.js";
import { ProposalService } from "../../apps/portfolio/src/domain/proposal-service.js";
import { InMemoryProposalRepository } from "../../apps/portfolio/src/infrastructure/in-memory-proposal-repository.js";
import { PortfolioService } from "../../apps/portfolio/src/domain/portfolio-service.js";
import { CommerceOfferService } from "../../apps/commerce/src/domain/commerce-offer.model.js";
import { SatimPaymentPort } from "../../apps/commerce/src/domain/satim-payment-port.js";
import { SolaraSocialService } from "../../apps/solara/src/domain/social.model.js";
import { IntelligenceRuntime, ProviderRouter } from "@mosaix/intelligence";
import { TypeSafeJevProvider } from "@mosaix/adapter-intelligence-typesafe";

class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();
  async findById(id: string) { return this.users.get(id) || null; }
  async findByEmail(email: string) {
    return Array.from(this.users.values()).find((u) => u.email === email) || null;
  }
  async save(user: User) {
    this.users.set(user.id, user);
    return user;
  }
}

class InMemoryVendableRepo {
  private items = new Map<string, Record<string, unknown>>();
  async findById(id: string) { return this.items.get(id) || null; }
  async findByReference(ref: string) {
    return Array.from(this.items.values()).find((i) => {
      const identity = i.identity as { reference?: string } | undefined;
      return identity?.reference === ref;
    }) || null;
  }
  async save(vendable: Record<string, unknown>) {
    const identity = vendable.identity as { id: string };
    this.items.set(identity.id, vendable);
    return vendable;
  }
  async listAll() {
    return Array.from(this.items.values());
  }
}

describe("End-to-End Multi-BAC Critical Workflows Integration Suite", () => {
  it("Flow 1: Citadelle User Registration & Security Workflow", async () => {
    const userRepo = new InMemoryUserRepository();
    const userService = new UserService(userRepo);

    const user = await userService.create({
      email: "citadelle.e2e@mosaix.platform",
      displayName: "Éléonore E2E",
      passwordHash: "scrypt$hashed_password_sample",
      roles: ["citizen", "merchant"],
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBe("citadelle.e2e@mosaix.platform");
    expect(user.roles).toContain("merchant");

    const retrieved = await userService.lookup({ id: user.id });
    expect(retrieved).not.toBeNull();
    expect(retrieved?.displayName).toBe("Éléonore E2E");
  });

  it("Flow 2: Portfolio Proposal Lifecycle & Automated Vendable Catalog Creation", async () => {
    const proposalRepo = new InMemoryProposalRepository();
    const vendableRepo = new InMemoryVendableRepo();
    const portfolioService = new PortfolioService(vendableRepo as unknown as Parameters<typeof PortfolioService.prototype.constructor>[0]);
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft(
      "space-caj-jijel",
      "usr_merchant_001",
      {
        suggestedReference: "REF-PROPOS-E2E-001",
        type: "Product",
        content: {
          translations: {
            fr: {
              name: "Poudre de Céramique CAJ Jijel",
              shortDescription: "Céramique artisanale de haute pureté",
              description: "Poudre de céramique de qualité supérieure extraite et traitée pour les artisans.",
            },
          },
        },
      }
    );

    expect(draft.status).toBe("Draft");

    const submitted = await proposalService.submit(draft.id, "space-caj-jijel");
    expect(submitted.status).toBe("Submitted");

    const inReview = await proposalService.claimInReview(submitted.id, "usr_admin_platform");
    expect(inReview.status).toBe("InReview");

    const approvedResult = await proposalService.approve(
      inReview.id,
      "usr_admin_platform"
    );

    expect(approvedResult.proposal.status).toBe("Approved");
    expect(approvedResult.vendableId).toBeDefined();

    const fetchApproved = await proposalRepo.findById(draft.id);
    expect(fetchApproved?.vendableId).toBe(approvedResult.vendableId);
  });

  it("Flow 3: Commerce Seller Offer & SATIM Algerian Gateway Authorization", async () => {
    const offerService = new CommerceOfferService();
    const offer = await offerService.createOffer({
      seller: { type: "merchant", id: "usr_merchant_001" },
      vendableId: "vnd_987",
      priceInCents: 500000,
      currency: "DZD",
      stockAllocation: 25,
      commissionRateBps: 300,
    });

    expect(offer.id).toBeDefined();
    expect(offer.priceInCents).toBe(500000);
    expect(offer.status).toBe("ACTIVE");

    const satimPort = new SatimPaymentPort({
      terminalId: "MOSAIX_TERM_01",
      secretKey: "SATIM_SECRET_TEST_KEY_E2E",
      apiUrl: "https://test.satim.dz/payment",
    });

    await satimPort.authorize("ord_e2e_satim_1", 500000, "idemp-e2e-1791413631817");
    await satimPort.void("ord_e2e_satim_1", "idemp-e2e-1791413631820");
  });

  it("Flow 4: Solara Social Feed & Intelligence Core IJIDeals Integration Workflow", async () => {
    const socialService = new SolaraSocialService();
    const post = await socialService.createPost({
      authorType: "citizen",
      authorId: "usr_merchant_001",
      targetType: "space",
      targetId: "space-caj-jijel",
      publicationType: "Annonce Commerciale",
      title: "Céramique CAJ Jijel",
      content: "Découvrez nos nouvelles poudres de céramique CAJ Jijel sur MosaiX !",
    });

    expect(post.id).toBeDefined();

    const router = new ProviderRouter();
    router.register(new TypeSafeJevProvider());

    const runtime = new IntelligenceRuntime(router);
    const decisionResult = await runtime.decide({
      capability: "commerce.product.classify",
      state: { title: post.title },
    });

    expect(decisionResult).toBeDefined();
    expect(decisionResult.decisionId).toBeDefined();
    expect(decisionResult.confidence).toBeGreaterThan(0.5);
  });
});
