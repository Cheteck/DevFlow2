import { describe, expect, it } from "vitest";
import { Router } from "@mosaix/http";
import { PortfolioService } from "./domain/portfolio-service.js";
import { ProposalService } from "./domain/proposal-service.js";
import { ProductWizardService } from "./domain/product-wizard.service.js";
import { OperationalKeyForbiddenError } from "./domain/portfolio-errors.js";
import { PortfolioBulkExporter, PortfolioBulkImporter } from "./domain/portfolio-bulk-media.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";
import { InMemoryProposalRepository } from "./infrastructure/in-memory-proposal-repository.js";
import { mountPortfolioRoutes } from "./composition-root.js";
import { VendableWorkflow } from "./vendable-workflow.js";
import { generatePortfolioOpenApi } from "./infrastructure/portfolio-controller.js";
import { createPortfolioView, createPortfolioDescriptor } from "./presentation/portfolio-view.js";

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
      variants: [
        { name: "Version 1TB", sku: "SKU-XIAOMI-18-WIZ-1TB", attributes: { stockage: "1TB" } },
      ],
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

  it("should export PIM-only bulk data and reject commercial fields", async () => {
    const csvExport = PortfolioBulkExporter.toCsv([]);
    expect(csvExport).toBeDefined();
    expect(csvExport).not.toContain("price");

    const { valid, errors } = PortfolioBulkImporter.fromCsv(
      "id,title,category,price,stock\nv1,Table,Meubles,450,3",
    );
    expect(valid).toHaveLength(1);
    expect(errors.some((e) => e.includes("commercial columns ignored"))).toBe(true);
    expect(valid[0]).not.toHaveProperty("pricing");
  });

  it("should reject top-level pricing/inventory on create (PIM purity guard)", async () => {
    const vendableRepo = new InMemoryVendableRepository();
    const service = new PortfolioService(vendableRepo);

    const base = {
      identity: { id: "vnd_com_01", reference: "REF-COM-01", type: "Product" as const, status: "Draft" as const },
      content: { fr: { name: "Produit commercial" } },
      characteristics: { attributes: {} },
      classification: {},
      media: [],
      variants: [],
      relations: [],
    };

    await expect(
      service.createVendable({ ...base, pricing: { basePrice: 10, currency: "EUR" } } as never),
    ).rejects.toBeInstanceOf(OperationalKeyForbiddenError);

    await expect(
      service.createVendable({
        ...base,
        identity: { ...base.identity, id: "vnd_com_02", reference: "REF-COM-02" },
        variants: [{ id: "v1", reference: "V1", inventory: { stock: 1 } }],
      } as never),
    ).rejects.toBeInstanceOf(OperationalKeyForbiddenError);
  });

  it("should render portfolio UI view with tabs and dashboard metrics", async () => {
    const view = createPortfolioView();

    const dashboardResult = await view.render({ query: { view: "dashboard" } });
    expect(dashboardResult.contentHtml).toContain("Statut du Catalogue Réel");

    const featuresResult = await view.render({ query: { view: "features" } });
    expect(featuresResult.contentHtml).toContain("Catalogue des Caractéristiques");

    const categoriesResult = await view.render({ query: { view: "categories" } });
    expect(categoriesResult.contentHtml).toContain("Arborescence des Catégories");

    const bulkResult = await view.render({ query: { view: "bulk" } });
    expect(bulkResult.contentHtml).toContain("Import & Export de Masse");
  });

  it("should expose a shell descriptor mapping execution context to the view", async () => {
    const descriptor = createPortfolioDescriptor();
    expect(descriptor.id).toBe("@apps/portfolio");
    expect(descriptor.routePrefix).toBe("/portfolio");
    expect(descriptor.requiredPermissions).toContain("portfolio:vendable:read:tenant");
    await expect(descriptor.isAvailable()).resolves.toBe(true);

    const rendered = await descriptor.render({
      tenantId: "tenant_test",
      spaceId: null,
      user: { id: "usr_1", roles: ["admin"], permissions: [], isAuthenticated: true },
      theme: { mode: "light" },
      request: { path: "/portfolio", query: { view: "dashboard" }, headers: {} },
    });
    expect(rendered.contentHtml).toContain("Statut du Catalogue Réel");
  });

  it("should enforce Guard authorization and map domain errors on HTTP routes", async () => {
    const vendableRepo = new InMemoryVendableRepository();
    const service = new PortfolioService(vendableRepo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioRoutes(router, {
      portfolioService: service,
      vendableRepository: vendableRepo,
      vendableWorkflow: workflow,
    });

    const anonymous = await router.handle({
      method: "GET",
      path: "/portfolio/catalog",
      headers: {},
    });
    expect(anonymous.statusCode).toBe(401);

    const principal = { sub: "usr_admin", tenantId: "tenant_test", roles: ["admin"] };

    const badCreate = await router.handle({
      method: "POST",
      path: "/portfolio/vendables",
      headers: {},
      principal,
      body: { name: "", type: "product" },
    });
    expect(badCreate.statusCode).toBe(400);

    const created = await router.handle({
      method: "POST",
      path: "/portfolio/vendables",
      headers: {},
      principal,
      body: { name: "Route guard test", type: "product" },
    });
    expect(created.statusCode).toBe(201);

    const missing = await router.handle({
      method: "POST",
      path: "/portfolio/vendables/publish",
      headers: {},
      principal,
      body: { id: "vend_unknown" },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("should generate an OpenAPI spec without error", () => {
    const vendableRepo = new InMemoryVendableRepository();
    const service = new PortfolioService(vendableRepo);
    const workflow = new VendableWorkflow();
    const router = new Router();
    mountPortfolioRoutes(router, {
      portfolioService: service,
      vendableRepository: vendableRepo,
      vendableWorkflow: workflow,
    });

    const spec = generatePortfolioOpenApi(router) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.0.0");
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        "/portfolio/catalog",
        "/portfolio/vendables",
        "/portfolio/vendables/publish",
      ]),
    );
  });
});
