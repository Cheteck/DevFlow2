import { Controller, type HttpRequest, type HttpResponse, getFeatureFlagsProvider } from "@mosaix/sdk";
import type { FeatureFlagsPort } from "@mosaix/ports-feature-flags";
import { GovernancePolicyRegistry, type GovernancePolicy } from "../domain/governance-policy";
import { PlatformTopologyService } from "../domain/platform-topology.service";
import { PlatformSettingsService } from "../domain/platform-settings.service";
import { GovernanceSlotResolver } from "../domain/governance-slot-resolver";
import { AuditLogModel } from "../domain/audit-log.model";
import { ImperiaPluginManagerService, type PrestaPluginCategory } from "../domain/plugin-manager.service";
import { ControlPlaneSupervisorService } from "../domain/control-plane-supervisor.service";
import { MigrationGovernanceService } from "../domain/migration-governance.service";
import type { PostgresImperiaRepository } from "./postgres-imperia-repository.js";

export class ImperiaGovernanceController extends Controller {
  private auditLogs: AuditLogModel[] = [];
  private static readonly MAX_AUDIT_LOGS = 1000;

  constructor(
    private policyRegistry: GovernancePolicyRegistry = new GovernancePolicyRegistry(),
    private topologyService: PlatformTopologyService = new PlatformTopologyService(),
    private settingsService: PlatformSettingsService = new PlatformSettingsService(),
    private slotResolver: GovernanceSlotResolver = new GovernanceSlotResolver(),
    private pluginManager: ImperiaPluginManagerService = new ImperiaPluginManagerService(),
    private controlPlaneSupervisor: ControlPlaneSupervisorService = new ControlPlaneSupervisorService(),
    private migrationGovernance: MigrationGovernanceService = new MigrationGovernanceService(),
    private featureFlagsPort?: FeatureFlagsPort,
    private postgresRepo?: PostgresImperiaRepository
  ) {
    super();
  }

  private recordAuditLog(actorId: string, action: string, resource: string, status: "success" | "failure", metadata?: Record<string, unknown>): AuditLogModel {
    const log = new AuditLogModel();
    log.actorId = actorId;
    log.action = action;
    log.resource = resource;
    log.status = status;
    if (metadata) {
      log.metadata = metadata;
    }
    log.createdAt = new Date();
    this.auditLogs.push(log);
    // Bound in-memory audit buffer to prevent unbounded growth in production.
    if (this.auditLogs.length > ImperiaGovernanceController.MAX_AUDIT_LOGS) {
      this.auditLogs = this.auditLogs.slice(-ImperiaGovernanceController.MAX_AUDIT_LOGS);
    }
    if (this.postgresRepo) {
      void this.postgresRepo.saveAuditLog({
        actorId,
        action,
        resource,
        status,
        metadata,
        createdAt: log.createdAt,
      }).catch((err: unknown) => {
        console.error("[Imperia] Failed to persist audit log to Postgres:", err);
      });
    }
    return log;
  }

  private actorId(req: HttpRequest): string {
    return req.principal?.sub ?? "anonymous";
  }

  private requireAdmin(req: HttpRequest): HttpResponse | null {
    const roles = req.principal?.roles ?? [];
    if (!req.principal || (!roles.includes("admin") && !roles.includes("platform-governor"))) {
      return this.json({ error: "Forbidden: admin role required" }, 403);
    }
    return null;
  }

  async getHealth(_req: HttpRequest): Promise<HttpResponse> {
    return this.json({
      status: "healthy",
      application: "imperia",
      governanceState: "operational",
      timestamp: new Date().toISOString(),
    });
  }

  async getTopologySummary(_req: HttpRequest): Promise<HttpResponse> {
    const topology = this.topologyService.getTopologyOverview();
    return this.json({
      activeBoundedContexts: topology.contexts.map((c) => c.id),
      totalContexts: topology.totalContexts,
      averageConformanceScore: topology.averageConformanceScore,
      controlPlaneActive: true,
      governancePoliciesLoaded: this.policyRegistry.listPolicies().length,
      details: topology.contexts,
    });
  }

  async listPolicies(_req: HttpRequest): Promise<HttpResponse> {
    return this.json({
      policies: this.policyRegistry.listPolicies(),
    });
  }

  async createPolicy(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;
    const body = req.body as GovernancePolicy;
    if (!body || !body.id || !body.name) {
      this.recordAuditLog(this.actorId(req), "CREATE_POLICY", body?.id ?? "unknown", "failure", { reason: "Missing id or name" });
      return this.badRequest("Policy id and name are required.");
    }
    this.policyRegistry.registerPolicy({ ...body, enabled: body.enabled ?? true });
    this.recordAuditLog(this.actorId(req), "CREATE_POLICY", body.id, "success", { policyName: body.name });
    return this.created({ message: "Policy registered successfully", policy: body });
  }

  async listSettings(_req: HttpRequest): Promise<HttpResponse> {
    const settings = await this.settingsService.listSettings();
    return this.json({ settings });
  }

  async getSettingsByCategory(req: HttpRequest): Promise<HttpResponse> {
    const category = req.query?.["category"] as import("../domain/platform-settings.service.js").SettingCategory;
    if (!category) {
      return this.listSettings(req);
    }
    const settings = await this.settingsService.getSettingsByCategory(category);
    return this.json({ category, settings });
  }

  async updateSetting(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;
    const body = req.body as { key: string; value: string };
    if (!body || !body.key) {
      this.recordAuditLog(this.actorId(req), "UPDATE_SETTING", body?.key ?? "unknown", "failure", { reason: "Missing setting key" });
      return this.badRequest("Setting key is required.");
    }
    await this.settingsService.setOverride(body.key, String(body.value));
    const updated = await this.settingsService.getSetting(body.key);
    this.recordAuditLog(this.actorId(req), "UPDATE_SETTING", body.key, "success", { newValue: updated.value });
    return this.json({ message: "Setting updated successfully", setting: updated });
  }

  async updateBatchSettings(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;
    const body = req.body as { settings: Record<string, string> };
    if (!body || !body.settings || typeof body.settings !== "object") {
      return this.badRequest("Payload must contain a 'settings' key-value map.");
    }
    await this.settingsService.setMultipleOverrides(body.settings);
    const updatedList = await this.settingsService.listSettings();
    this.recordAuditLog(this.actorId(req), "UPDATE_BATCH_SETTINGS", "platform-settings", "success", {
      keysUpdated: Object.keys(body.settings),
    });
    return this.json({ message: "Batch settings updated successfully", settings: updatedList });
  }

  async listGovernanceSlots(_req: HttpRequest): Promise<HttpResponse> {
    const pages = this.slotResolver.getGovernancePages();
    return this.json({ governancePages: pages });
  }

  async listAuditLogs(_req: HttpRequest): Promise<HttpResponse> {
    if (this.postgresRepo) {
      try {
        const fromDb = await this.postgresRepo.getAuditLogs();
        if (fromDb.length > 0) {
          return this.json({ auditLogs: fromDb });
        }
      } catch (err: unknown) {
        console.error("[Imperia] Failed to fetch audit logs from Postgres:", err);
      }
    }
    return this.json({ auditLogs: this.auditLogs });
  }

  async listPlugins(req: HttpRequest): Promise<HttpResponse> {
    const category = req.query?.["category"] as PrestaPluginCategory | undefined;
    const plugins = this.pluginManager.listPlugins(category);
    return this.json({ plugins, total: plugins.length });
  }

  async executePluginAction(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;
    const body = req.body as {
      pluginId: string;
      action: "install" | "enable" | "disable" | "reset" | "uninstall" | "configure";
      configurationValues?: Record<string, unknown>;
    };

    if (!body || !body.pluginId || !body.action) {
      return this.badRequest("pluginId and action are required.");
    }

    try {
      let updatedPlugin;
      switch (body.action) {
        case "install":
          updatedPlugin = this.pluginManager.install(body.pluginId);
          break;
        case "enable":
          updatedPlugin = this.pluginManager.enable(body.pluginId);
          break;
        case "disable":
          updatedPlugin = this.pluginManager.disable(body.pluginId);
          break;
        case "reset":
          updatedPlugin = this.pluginManager.reset(body.pluginId);
          break;
        case "uninstall":
          updatedPlugin = this.pluginManager.uninstall(body.pluginId);
          break;
        case "configure":
          updatedPlugin = this.pluginManager.configure(body.pluginId, body.configurationValues ?? {});
          break;
        default:
          return this.badRequest(`Unsupported plugin action [${body.action}]`);
      }

      this.recordAuditLog(this.actorId(req), `PLUGIN_${body.action.toUpperCase()}`, body.pluginId, "success", {
        pluginName: updatedPlugin.name,
        action: body.action,
      });

      return this.json({ message: `Plugin action [${body.action}] executed successfully`, plugin: updatedPlugin });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.recordAuditLog(this.actorId(req), `PLUGIN_${body.action.toUpperCase()}`, body.pluginId, "failure", { error: errorMsg });
      return this.badRequest(errorMsg);
    }
  }

  async listDLQItems(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;
    return this.json({ dlqItems: this.controlPlaneSupervisor.getDLQItems() });
  }

  async replayDLQItem(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;
    const body = req.body as { id: string };
    if (!body || !body.id) {
      return this.badRequest("DLQ item id is required.");
    }
    const result = this.controlPlaneSupervisor.replayDLQItem(body.id);
    this.recordAuditLog(this.actorId(req), "REPLAY_DLQ_ITEM", body.id, "success");
    return this.json(result);
  }

  async listCircuitBreakers(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;
    return this.json({ circuitBreakers: this.controlPlaneSupervisor.getCircuitBreakers() });
  }

  async resetCircuitBreaker(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;
    const body = req.body as { id: string };
    if (!body || !body.id) {
      return this.badRequest("Circuit Breaker id is required.");
    }
    const cb = this.controlPlaneSupervisor.resetCircuitBreaker(body.id);
    this.recordAuditLog(this.actorId(req), "RESET_CIRCUIT_BREAKER", body.id, "success");
    return this.json({ message: "Circuit breaker reset successfully", circuitBreaker: cb });
  }

  async listMigrations(_req: HttpRequest): Promise<HttpResponse> {
    return this.json({ migrations: this.migrationGovernance.listMigrations() });
  }

  async previewMigrationSQL(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as { id: string };
    if (!body || !body.id) {
      return this.badRequest("Migration id is required.");
    }
    const preview = this.migrationGovernance.previewMigrationSQL(body.id);
    return this.json({ preview });
  }

  // =========================================================================
  // FEATURE FLAGS GOVERNANCE
  // =========================================================================

  private getEffectiveFlagsPort(): FeatureFlagsPort | null {
    return this.featureFlagsPort || getFeatureFlagsProvider();
  }

  async listFeatureFlags(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;

    const port = this.getEffectiveFlagsPort();
    if (port && typeof port.listFlags === "function") {
      const flags = await port.listFlags();
      return this.json({ flags });
    }

    // Fallback if port does not implement listFlags
    return this.json({
      flags: [],
      warning: "No FeatureFlagsPort with list capability registered."
    });
  }

  async setFeatureFlag(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;

    const body = req.body as { key: string; value: boolean | string; description?: string };
    if (!body || !body.key || body.value === undefined) {
      return this.badRequest("Flag 'key' and 'value' are required.");
    }

    const port = this.getEffectiveFlagsPort();
    if (port && typeof port.setFlag === "function") {
      await port.setFlag(body.key, body.value, body.description);
      this.recordAuditLog(
        this.actorId(req),
        "SET_FEATURE_FLAG",
        body.key,
        "success",
        { value: body.value, description: body.description }
      );
      return this.json({
        message: `Feature flag '${body.key}' updated successfully.`,
        key: body.key,
        value: body.value
      });
    }

    return this.internalError("Active FeatureFlags provider does not support dynamic updates.");
  }

  async toggleFeatureFlag(req: HttpRequest): Promise<HttpResponse> {
    const forbidden = this.requireAdmin(req);
    if (forbidden) return forbidden;

    const body = req.body as { key: string };
    if (!body || !body.key) {
      return this.badRequest("Flag 'key' is required.");
    }

    const port = this.getEffectiveFlagsPort();
    if (port && typeof port.isEnabled === "function" && typeof port.setFlag === "function") {
      const current = await port.isEnabled(body.key, undefined, false);
      const updated = !current;
      await port.setFlag(body.key, updated);

      this.recordAuditLog(
        this.actorId(req),
        "TOGGLE_FEATURE_FLAG",
        body.key,
        "success",
        { previous: current, updated }
      );

      return this.json({
        message: `Feature flag '${body.key}' toggled to ${updated}.`,
        key: body.key,
        enabled: updated
      });
    }

    return this.internalError("Active FeatureFlags provider does not support dynamic toggling.");
  }
}
