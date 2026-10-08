import { describe, expect, it } from "vitest";
import { PortfolioService } from "./domain/portfolio-service.js";
import { ProposalService } from "./domain/proposal-service.js";
import { ProductWizardService } from "./domain/product-wizard.service.js";
import { ShopAnalyticsService } from "./domain/shop-analytics.service.js";
import { ShopInventoryReportService } from "./domain/shop-inventory-report.service.js";
import { PortfolioBulkExporter } from "./domain/portfolio-bulk-media.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";
import { InMemoryProposalRepository } from "./infrastructure/in-memory-proposal-repository.js";
import { createPortfolioView } from "./presentation/portfolio-view.js";

describe("@apps/portfolio Domain Services & Presentation Integration Suite", () => {
  it("should create and search vendables", async () => {
    const vendableRepo = new InMemoryVendableRepository();
    const service = new PortfolioService(vendableRepo);

    const created = await service.createVendable({
      identity: {
        id: "vnd_test_01",
        reference: "REF-XIAOMI-TEST",
        type: "Product",
        status: "Draft",
      },
      content: {
        fr: {
          name: "Xiaomi 18 Pro Max Test Edition",
          shortDescription: "Smartphone test",
          description: "Description complète du smartphone de test Xiaomi.",
        },
      },
      characteristics: {
        attributes: {
          brand: "Xiaomi",
          ram: "24GB",
          battery: "8500mAh",
        },
      },
      classification: {
        categories: ["smartphones"],
        tags: ["high-tech"],
      },
      media: [
        {
          id: "med_01",
          url: "https://cdn.mosaix.platform/xiaomi.jpg",
          isPrimary: true,
          metadata: { checkKey: "portfolio-service.ts:135" },
        },
      ],
      variants: [],
      relations: [],
    });

    expect(created.identity.id).toBe("vnd_test_01");

    const found = await service.findVendable("vnd_test_01");
    expect(found).not.toBeUndefined();
    expect(found?.content.fr?.name).toBe("Xiaomi 18 Pro Max Test Edition");

    const searchResults = await service.search({ type: "Product" });
    expect(searchResults.length).toBeGreaterThan(0);
  });

  it("should execute proposal lifecycle from draft to approved vendable publication", async () => {
    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const proposalRepo = new InMemoryProposalRepository();
    const proposalService = new ProposalService(proposalRepo, portfolioService);

    const draft = await proposalService.createDraft("space-jijel", "usr_merchant_01", {
      suggestedReference: "REF-PROP-JIJEL-01",
      type: "Product",
      content: {
        translations: {
          fr: {
            name: "Poudre de Céramique CAJ Jijel",
            shortDescription: "Céramique de haute qualité",
            description: "Poudre certifiée artisanale de Jijel.",
          },
        },
      },
    });

    expect(draft.status).toBe("Draft");

    const submitted = await proposalService.submit(draft.id, "space-jijel");
    expect(submitted.status).toBe("Submitted");

    const inReview = await proposalService.claimInReview(submitted.id, "usr_admin_01");
    expect(inReview.status).toBe("InReview");

    const approvedResult = await proposalService.approve(inReview.id, "usr_admin_01");
    expect(approvedResult.proposal.status).toBe("Approved");
    expect(approvedResult.vendableId).toBeDefined();

    const createdVendable = await portfolioService.findVendable(approvedResult.vendableId);
    expect(createdVendable).not.toBeUndefined();
  });

  it("should validate wizard step inputs and state flow", async () => {
    const wizard = new ProductWizardService();
    const draft = wizard.startDraft("usr_merchant_01", "space-jijel");

    const s1 = wizard.saveStep1(draft.draftId, {
      name: "Xiaomi 18 Wizard",
      reference: "REF-WIZARD-XIAOMI",
      type: "Product",
      category: "smartphones",
      description: "Wizard test desc",
      tags: ["tech"],
    });
    expect(s1.valid).toBe(true);

    const s2 = wizard.saveStep2(draft.draftId, {
      basePrice: 180000,
      currency: "DZD",
      sku: "SKU-XIAOMI-18-WIZ",
      stock: 20,
      reorderPoint: 5,
      variants: [],
    });
    expect(s2.valid).toBe(true);

    const s3 = wizard.saveStep3(draft.draftId, {
      mediaUrls: ["https://cdn.mosaix.platform/wizard.jpg"],
    });
    expect(s3.valid).toBe(true);

    const s4 = wizard.saveStep4(draft.draftId, {
      slug: "xiaomi-18-pro",
      metaTitle: "Xiaomi 18 Pro",
      metaDesc: "Xiaomi 18 Pro Max 5G",
      targetStatus: "In Review",
    });
    expect(s4.valid).toBe(true);

    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const result = await wizard.finalizeAndPublish(draft.draftId, portfolioService);

    expect(result.identity.reference).toBe("REF-WIZARD-XIAOMI");
    expect(result.identity.status).toBe("In Review");
  });

  it("should record traffic visits, generate inventory reports and bulk exports", async () => {
    const analyticsService = new ShopAnalyticsService();
    const summary = analyticsService.getTrafficSummary("space-jijel", "today");
    expect(summary).toBeDefined();

    const vendableRepo = new InMemoryVendableRepository();
    const portfolioService = new PortfolioService(vendableRepo);
    const inventoryService = new ShopInventoryReportService();
    const report = await inventoryService.generateReport(portfolioService, "space-jijel");
    expect(report.spaceId).toBe("space-jijel");

    const csvExport = PortfolioBulkExporter.toCsv([]);
    expect(csvExport).toBeDefined();
  });

  it("should render portfolio UI view with tabs and dashboard metrics", async () => {
    const view = createPortfolioView();

    const dashboardResult = await view.render({ query: { view: "dashboard" } });
    expect(dashboardResult.contentHtml).toContain("Indicateurs de Qualité du Catalogue");

    const featuresResult = await view.render({ query: { view: "features" } });
    expect(featuresResult.contentHtml).toContain("CS-Cart EAV Engine");

    const categoriesResult = await view.render({ query: { view: "categories" } });
    expect(categoriesResult.contentHtml).toContain("Arborescence & Taxonomie des Catégories");

    const bulkResult = await view.render({ query: { view: "bulk" } });
    expect(bulkResult.contentHtml).toContain("Import & Export de Masse");
  });
});
