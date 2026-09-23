/**
 * @apps/portfolio — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap } from "@mosaix/sdk";
import { MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import type { WorkflowStatus } from "./domain/vendable.js";

import type { DatabasePort } from "@mosaix/ports-database";
import { PortfolioService } from "./domain/portfolio-service.js";
import type { VendableRepository } from "./domain/vendable-repository.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";
import { PostgresVendableRepository } from "./infrastructure/postgres-vendable-repository.js";
import { VendableWorkflow } from "./vendable-workflow.js";
import { mountPortfolioRoutes } from "./composition-root.js";

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
    "portfolio.workflow.updated",
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
      repository = new InMemoryVendableRepository();
    }

    container.instance("vendableRepository", repository);
    container.instance(PortfolioService, new PortfolioService(repository));
    container.singleton(VendableWorkflow, () => new VendableWorkflow());
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    const kernel = container.resolve<RuntimeKernel>("kernel");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant: { organizationId: "default" } },
      kernel
    );

    const portfolioService = container.resolve(PortfolioService);
    const vendableWorkflow = container.resolve(VendableWorkflow);
    const vendableRepository = container.resolve<VendableRepository>("vendableRepository");

    app.provideCapability("portfolio.vendable.create", async (input) => {
      return portfolioService.createVendable(input as never);
    });

    app.provideCapability("portfolio.vendable.read", async (input) => {
      const inp = input as { id?: string };
      if (inp.id) return portfolioService.findVendable(inp.id);
      return portfolioService.listVendables();
    });

    app.provideCapability("portfolio.vendable.publish", async (input) => {
      const inp = input as { vendableId?: string; status?: string; qualityPassed?: boolean };
      return vendableWorkflow.publish({
        vendableId: inp.vendableId ?? "",
        status: (inp.status as WorkflowStatus) ?? "Draft",
        qualityPassed: inp.qualityPassed ?? true,
      });
    });

    app.provideCapability("portfolio.vendable.search", async (input) => {
      const inp = input as { criteria?: Record<string, unknown> };
      return portfolioService.search(inp.criteria ?? {});
    });

    // Single route source: legacy composition-root mounts here (no string dup).
    mountPortfolioRoutes(router, { vendableRepository, vendableWorkflow });

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
export * from "./domain/portfolio-errors.js";
export * from "./infrastructure/persistence/vendable.model.js";
export * from "./vendable-workflow.js";
