/**
 * @apps/portfolio — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap } from "@mosaix/sdk";
import { MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";

import type { DatabasePort } from "@mosaix/ports-database";
import { PortfolioService } from "./domain/portfolio-service.js";
import type { VendableRepository } from "./domain/vendable-repository.js";
import { PostgresVendableRepository } from "./infrastructure/postgres-vendable-repository.js";
import { ProposalService } from "./domain/proposal-service.js";
import type { ProposalRepository } from "./domain/proposal-repository.js";
import { PostgresProposalRepository } from "./infrastructure/postgres-proposal-repository.js";
import { VendableWorkflow } from "./vendable-workflow.js";
import { mountPortfolioRoutes } from "./composition-root.js";
import {
  registerPortfolioApplication,
  type VendableCreatedPayload,
  type VendablePublishedPayload,
} from "./application/portfolio-application.js";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@apps/portfolio",
  name: "Portfolio & Product Information",
  version: "1.0.0",
  domain: { name: "portfolio" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "portfolio.vendable.create", version: "1.0.0" },
    { id: "portfolio.vendable.read", version: "1.0.0" },
    { id: "portfolio.vendable.publish", version: "1.0.0" },
    { id: "portfolio.vendable.search", version: "1.0.0" },
  ],
  permissions: [
    "portfolio:vendable:create:tenant",
    "portfolio:vendable:read:tenant",
    "portfolio:vendable:publish:tenant",
    "portfolio:vendable:search:tenant",
  ],
  events: [
    "portfolio.vendable.created",
    "portfolio.vendable.published",
  ],
  experience: {
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export interface PortfolioAdapters {
  vendableRepository?: () => VendableRepository;
  proposalRepository?: () => ProposalRepository;
  databasePort?: DatabasePort;
}

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class PortfolioServiceProvider {
  constructor(private readonly adapters: PortfolioAdapters = {}) {}

  register(container: Container): void {
    let repository: VendableRepository;
    if (this.adapters.vendableRepository) {
      repository = this.adapters.vendableRepository();
    } else if (this.adapters.databasePort) {
      repository = new PostgresVendableRepository(this.adapters.databasePort);
    } else {
      // Pas de stockage en memoire hors tests : exiger un DatabasePort
      // (Postgres) ou un repository explicite (tests uniquement).
      throw new Error(
        "[PortfolioAdapters] DatabasePort requis : passez databasePort (Postgres) ou vendableRepository (tests uniquement).",
      );
    }

    container.instance("vendableRepository", repository);
    container.instance(PortfolioService, new PortfolioService(repository));
    container.singleton(VendableWorkflow, () => new VendableWorkflow());

    let proposalRepository: ProposalRepository;
    if (this.adapters.proposalRepository) {
      proposalRepository = this.adapters.proposalRepository();
    } else if (this.adapters.databasePort) {
      proposalRepository = new PostgresProposalRepository(this.adapters.databasePort);
    } else {
      throw new Error(
        "[PortfolioAdapters] DatabasePort requis : passez databasePort (Postgres) ou proposalRepository (tests uniquement).",
      );
    }

    container.instance("proposalRepository", proposalRepository);
    container.instance(
      ProposalService,
      new ProposalService(proposalRepository, container.resolve(PortfolioService)),
    );
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    const kernel = container.resolve<RuntimeKernel>("kernel");
    let tenant: TenantIdentity;
    try {
      tenant = container.resolve<TenantIdentity>("tenant");
    } catch {
      tenant = { organizationId: "default" };
    }
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant },
      kernel
    );

    const portfolioService = container.resolve(PortfolioService);
    const vendableWorkflow = container.resolve(VendableWorkflow);
    const vendableRepository = container.resolve<VendableRepository>("vendableRepository");

    registerPortfolioApplication(app);

    app.provideCapability("portfolio.vendable.create", async (input) => {
      const created = await portfolioService.createVendable(input as never);
      const payload: VendableCreatedPayload = {
        vendableId: created.identity.id,
        reference: created.identity.reference,
        type: created.identity.type,
        status: created.identity.status,
      };
      await app.publish("portfolio.vendable.created", "1.0.0", payload);
      return created;
    });

    app.provideCapability("portfolio.vendable.read", async (input) => {
      const inp = input as { id?: string };
      if (inp.id) return portfolioService.findVendable(inp.id);
      return portfolioService.listVendables();
    });

    app.provideCapability("portfolio.vendable.publish", async (input) => {
      const inp = input as { vendableId?: string; status?: string; qualityPassed?: boolean };
      const publishStatuses = ["Published", "Draft", "In Review", "Archived", "Validated"] as const;
      const status = (
        (publishStatuses as readonly string[]).includes(inp.status ?? "") ? inp.status : "Draft"
      ) as (typeof publishStatuses)[number];
      const result = await vendableWorkflow.publish({
        vendableId: inp.vendableId ?? "",
        status,
        qualityPassed: inp.qualityPassed ?? true,
      });
      const payload: VendablePublishedPayload = {
        vendableId: inp.vendableId ?? "",
        reference: inp.vendableId ?? "",
        status: "Published",
      };
      await app.publish("portfolio.vendable.published", "1.0.0", payload);
      return result;
    });

    app.provideCapability("portfolio.vendable.search", async (input) => {
      const inp = input as { criteria?: Record<string, unknown> };
      return portfolioService.search(inp.criteria ?? {});
    });

    // Single route source: legacy composition-root mounts here (no string dup).
    mountPortfolioRoutes(router, { portfolioService, vendableRepository, vendableWorkflow });

    return app;
  }
}

// =============================================================
// SECTION 4 — BOOTSTRAP FACTORY
// =============================================================
export async function createPortfolioApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  adapters?: PortfolioAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new PortfolioServiceProvider(adapters),
  });
}

export const bootstrapPortfolioApp = createPortfolioApp;

// =============================================================
// SECTION 5 — DOMAIN EXPORTS
// =============================================================
export * from "./domain/vendable.js";
export * from "./domain/portfolio-service.js";
export * from "./domain/portfolio-search.port.js";
export * from "./domain/portfolio-bulk-media.js";
export * from "./domain/portfolio-errors.js";
export * from "./domain/product-wizard.service.js";
export * from "./domain/product-options.js";

export * from "./domain/proposal.js";
export * from "./domain/proposal-repository.js";
export * from "./domain/proposal-service.js";
export * from "./infrastructure/in-memory-vendable-repository.js";
export * from "./infrastructure/postgres-vendable-repository.js";
export * from "./infrastructure/in-memory-proposal-repository.js";
export * from "./infrastructure/postgres-proposal-repository.js";
export * from "./vendable-workflow.js";

