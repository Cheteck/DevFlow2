import type { Container, ServiceProvider, Router, HttpRequest } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import type { FeatureFlagsPort } from "@mosaix/ports-feature-flags";
import { ImperiaGovernanceController } from "./imperia-controller.js";
import { GovernancePolicyRegistry } from "../domain/governance-policy.js";
import { PlatformTopologyService } from "../domain/platform-topology.service.js";
import { PlatformSettingsService } from "../domain/platform-settings.service.js";
import { GovernanceSlotResolver } from "../domain/governance-slot-resolver.js";
import { ImperiaPluginManagerService } from "../domain/plugin-manager.service.js";
import { ControlPlaneSupervisorService } from "../domain/control-plane-supervisor.service.js";
import { MigrationGovernanceService } from "../domain/migration-governance.service.js";
import { PostgresImperiaRepository } from "./postgres-imperia-repository.js";
import { ControlPlaneServer } from "@mosaix/control-plane";

export interface ImperiaAppServiceProviderOptions {
  databasePort?: DatabasePort;
  featureFlagsPort?: FeatureFlagsPort;
}

export class ImperiaAppServiceProvider implements ServiceProvider {
  constructor(private readonly options: ImperiaAppServiceProviderOptions = {}) {}

  register(container: Container): void {
    const governancePolicyRegistry = new GovernancePolicyRegistry();
    const topologyService = new PlatformTopologyService();

    let postgresRepo: PostgresImperiaRepository | undefined;
    if (this.options.databasePort) {
      postgresRepo = new PostgresImperiaRepository(this.options.databasePort);
      container.instance("postgresImperiaRepository", postgresRepo);
    }

    const settingsService = new PlatformSettingsService(postgresRepo);
    const slotResolver = new GovernanceSlotResolver();
    const pluginManager = new ImperiaPluginManagerService();
    const controlPlaneSupervisor = new ControlPlaneSupervisorService(postgresRepo);
    const migrationGovernance = new MigrationGovernanceService();
    const controlPlaneServer = new ControlPlaneServer();

    const controller = new ImperiaGovernanceController(
      governancePolicyRegistry,
      topologyService,
      settingsService,
      slotResolver,
      pluginManager,
      controlPlaneSupervisor,
      migrationGovernance,
      this.options.featureFlagsPort,
      postgresRepo
    );

    container.instance(GovernancePolicyRegistry, governancePolicyRegistry);
    container.instance(PlatformTopologyService, topologyService);
    container.instance(PlatformSettingsService, settingsService);
    container.instance(GovernanceSlotResolver, slotResolver);
    container.instance(ImperiaPluginManagerService, pluginManager);
    container.instance(ControlPlaneSupervisorService, controlPlaneSupervisor);
    container.instance(MigrationGovernanceService, migrationGovernance);
    container.instance(ImperiaGovernanceController, controller);
    container.instance(ControlPlaneServer, controlPlaneServer);
  }

  boot(container: Container, router?: Router): void {
    if (!router) return;
    const controller = container.resolve(ImperiaGovernanceController);

    router.get("/imperia/health", async (req: HttpRequest) => await controller.getHealth(req));
    router.get("/imperia/topology", async (req: HttpRequest) => await controller.getTopologySummary(req));
    router.get("/imperia/policies", async (req: HttpRequest) => await controller.listPolicies(req));
    router.post("/imperia/policies", async (req: HttpRequest) => await controller.createPolicy(req));
    router.get("/imperia/settings", async (req: HttpRequest) => await controller.listSettings(req));
    router.get("/imperia/settings/category", async (req: HttpRequest) => await controller.getSettingsByCategory(req));
    router.put("/imperia/settings", async (req: HttpRequest) => await controller.updateSetting(req));
    router.post("/imperia/settings/batch", async (req: HttpRequest) => await controller.updateBatchSettings(req));
    router.get("/imperia/governance-slots", async (req: HttpRequest) => await controller.listGovernanceSlots(req));
    router.get("/imperia/audit-logs", async (req: HttpRequest) => await controller.listAuditLogs(req));
    router.get("/imperia/plugins", async (req: HttpRequest) => await controller.listPlugins(req));
    router.post("/imperia/plugins/action", async (req: HttpRequest) => await controller.executePluginAction(req));
    router.get("/imperia/dlq", async (req: HttpRequest) => await controller.listDLQItems(req));
    router.post("/imperia/dlq/replay", async (req: HttpRequest) => await controller.replayDLQItem(req));
    router.get("/imperia/circuit-breakers", async (req: HttpRequest) => await controller.listCircuitBreakers(req));
    router.post("/imperia/circuit-breakers/reset", async (req: HttpRequest) => await controller.resetCircuitBreaker(req));
    router.get("/imperia/migrations/status", async (req: HttpRequest) => await controller.listMigrations(req));
    router.post("/imperia/migrations/preview", async (req: HttpRequest) => await controller.previewMigrationSQL(req));
    router.get("/imperia/feature-flags", async (req: HttpRequest) => await controller.listFeatureFlags(req));
    router.post("/imperia/feature-flags", async (req: HttpRequest) => await controller.setFeatureFlag(req));
    router.post("/imperia/feature-flags/toggle", async (req: HttpRequest) => await controller.toggleFeatureFlag(req));
  }
}
