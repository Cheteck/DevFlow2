/**
 * @apps/imperia — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap } from "@mosaix/sdk";
import { MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";
import type { FeatureFlagsPort } from "@mosaix/ports-feature-flags";

import { ImperiaAppServiceProvider } from "./infrastructure/imperia-service-provider.js";
import { ImperiaGovernanceController } from "./infrastructure/imperia-controller.js";
import { GovernancePolicyRegistry } from "./domain/governance-policy.js";
import { PlatformTopologyService } from "./domain/platform-topology.service.js";
import { PlatformSettingsService } from "./domain/platform-settings.service.js";
import { GovernanceSlotResolver } from "./domain/governance-slot-resolver.js";
import { ImperiaPluginManagerService } from "./domain/plugin-manager.service.js";
import { ControlPlaneSupervisorService } from "./domain/control-plane-supervisor.service.js";
import { MigrationGovernanceService } from "./domain/migration-governance.service.js";
import { ControlPlaneServer } from "@mosaix/control-plane";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@apps/imperia",
  name: "MosaiX Imperia Control Plane & Governance",
  version: "1.0.0",
  domain: { name: "imperia" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "imperia.governance.inspect", version: "1.0.0" },
    { id: "imperia.governance.audit", version: "1.0.0" },
    { id: "imperia.topology.query", version: "1.0.0" },
  ],
  permissions: [
    "imperia:governance:inspect:tenant",
    "imperia:governance:audit:tenant",
    "imperia:topology:query:tenant",
  ],
  events: [
    "imperia.policy.updated",
    "imperia.audit.logged",
    "imperia.circuit.tripped",
  ],
  experience: {
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export type ImperiaAdapters = {
  databasePort?: DatabasePort;
  featureFlagsPort?: FeatureFlagsPort;
};

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class ImperiaServiceProvider {
  private readonly innerProvider: ImperiaAppServiceProvider;

  constructor(adapters: ImperiaAdapters = {}) {
    this.innerProvider = new ImperiaAppServiceProvider({
      databasePort: adapters.databasePort,
      featureFlagsPort: adapters.featureFlagsPort,
    });
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

    const topologyService = container.resolve(PlatformTopologyService);
    app.provideCapability("imperia.governance.inspect", async () => {
      return topologyService.getTopologyOverview();
    });

    app.provideCapability("imperia.topology.query", async () => {
      return topologyService.getTopologyOverview();
    });

    return app;
  }
}

// =============================================================
// SECTION 4 — BOOTSTRAP FACTORY
// =============================================================
export async function createImperiaApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  _adapters?: ImperiaAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new ImperiaServiceProvider(),
  });
}

// Composition Root backwards-compatibility
export function createImperiaComposition(parentContainer?: Container, adapters?: ImperiaAdapters) {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const router = new Router();

  const provider = new ImperiaAppServiceProvider({
    databasePort: adapters?.databasePort,
    featureFlagsPort: adapters?.featureFlagsPort,
  });
  provider.register(container);
  provider.boot(container, router);

  return {
    container,
    router,
    controller: container.resolve(ImperiaGovernanceController),
    policyRegistry: container.resolve(GovernancePolicyRegistry),
    topologyService: container.resolve(PlatformTopologyService),
    settingsService: container.resolve(PlatformSettingsService),
    slotResolver: container.resolve(GovernanceSlotResolver),
    pluginManager: container.resolve(ImperiaPluginManagerService),
    controlPlaneSupervisor: container.resolve(ControlPlaneSupervisorService),
    migrationGovernance: container.resolve(MigrationGovernanceService),
    controlPlaneServer: container.resolve(ControlPlaneServer),
  };
}

// =============================================================
// SECTION 5 — DOMAIN EXPORTS
// =============================================================
export * from "./domain/audit-log.model.js";
export * from "./domain/governance-policy.js";
export * from "./domain/imperia-compliance-drift.js";
export * from "./domain/imperia-rego-cost-incident.js";
export * from "./domain/platform-topology.service.js";

export * from "./domain/platform-settings.service.js";
export * from "./domain/governance-slot-resolver.js";
export * from "./domain/plugin-manager.service.js";
export * from "./domain/control-plane-supervisor.service.js";
export * from "./domain/migration-governance.service.js";
export * from "./domain/maintenance.service.js";
export * from "./domain/category-analysis.service.js";

