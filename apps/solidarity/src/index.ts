/**
 * @apps/solidarity — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap, MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import type { ApplicationManifest } from "@mosaix/contracts";

import { SolidarityAppServiceProvider } from "./infrastructure/solidarity-service-provider.js";
import { SolidarityService } from "./infrastructure/solidarity-service.js";
import type { Incident, Need, Donation } from "./domain/models.js";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@apps/solidarity",
  name: "MosaiX Solidarity",
  version: "1.0.0",
  domain: { name: "solidarity" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "solidarity.incident.create", version: "1.0.0" },
    { id: "solidarity.need.declare", version: "1.0.0" },
    { id: "solidarity.donation.submit", version: "1.0.0" },
  ],
  permissions: [
    "solidarity:incident:create:tenant",
    "solidarity:need:declare:tenant",
    "solidarity:donation:submit:tenant",
  ],
  events: [
    "solidarity.incident.created",
    "solidarity.need.created",
  ],
  experience: {
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export type SolidarityAdapters = {
  databasePort?: DatabasePort;
};

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class SolidarityServiceProvider {
  private readonly innerProvider: SolidarityAppServiceProvider;

  constructor(adapters: SolidarityAdapters = {}) {
    this.innerProvider = new SolidarityAppServiceProvider(
      adapters.databasePort ? { databasePort: adapters.databasePort } : {},
    );
  }

  register(container: Container): void {
    this.innerProvider.register(container);
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    this.innerProvider.boot(container, router);

    const kernel = container.resolve<RuntimeKernel>("kernel");
    const tenant = container.resolve<TenantIdentity>("tenant");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant },
      kernel
    );

    const solidarityService = container.resolve(SolidarityService);
    app.provideCapability("solidarity.incident.create", async (input) => {
      const inp = input as Omit<Incident, "id" | "status">;
      return solidarityService.createIncident(inp);
    });

    app.provideCapability("solidarity.need.declare", async (input) => {
      const inp = input as Omit<Need, "id" | "quantitySatisfied" | "status" | "createdAt">;
      return solidarityService.declareNeed(inp);
    });

    app.provideCapability("solidarity.donation.submit", async (input) => {
      const inp = input as Omit<Donation, "id" | "verificationStatus" | "createdAt">;
      return solidarityService.submitDonation(inp);
    });

    return app;
  }
}

// =============================================================
// SECTION 4 — BOOTSTRAP FACTORY
// =============================================================
export async function createSolidarityApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  _adapters?: SolidarityAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new SolidarityServiceProvider(),
  });
}

export function createSolidarityComposition(parentContainer?: Container) {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const router = new Router();

  const provider = new SolidarityAppServiceProvider();
  provider.register(container);
  provider.boot(container, router);

  return {
    container,
    router,
    solidarityService: container.resolve(SolidarityService),
  };
}

export * from "./domain/models.js";
export * from "./application/solidarity-commands.js";
export * from "./infrastructure/solidarity-service.js";
