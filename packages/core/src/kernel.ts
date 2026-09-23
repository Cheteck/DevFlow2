/**
 * @mosaix/core — Runtime Kernel
 *
 * Minimal orchestration core (ADR-0002). It does NOT own the shared backbone:
 * EventStore, PermissionRegistry, DomainEventBus, AuthorizationEngine and
 * CapabilityRegistry are provided by installed `KernelModule`s and reached
 * through the stable `KernelContext` (kernel-module.ts — unique source).
 *
 * The kernel only:
 *  1. installs modules (`install` / `registerModule` alias),
 *  2. drives lifecycle (`initialize`/`start`/`stop`) with a 7-state machine
 *     (contracts/runtime.ts: CREATED→INITIALIZING→READY→RUNNING→STOPPING→STOPPED/FAILED),
 *  3. enforces the execution boundary (permission → contract → execution),
 *  4. exposes a backward-compatible facade over the module services.
 *
 * Future capabilities are added as new modules — never by modifying this file.
 */

import type {
  ApplicationManifest,
  RuntimeKernelState,
  TenantIdentity,
} from "@mosaix/contracts";
import { ApplicationManifestSchema } from "@mosaix/schemas";
import { KernelContext, type KernelConfig, type KernelModule, type KernelOptions } from "./kernel-module";
import { Invariants } from "./invariants";
import { RouteRegistry } from "./route-registry";
import type { LifecycleCallbacks } from "./lifecycle";
import {
  asKernelError,
  AuthorizationError,
  CapabilityError,
  LifecycleError,
  RegistrationError,
} from "./kernel-errors";
import { ObservabilityModule } from "./modules/observability-module";
import { defaultModules } from "./modules";
import type { Logger, Metrics, Trace } from "./observability";
import type { CapabilityEntry, PayloadValidator } from "./capability-registry";

export type { KernelOptions };
export type KernelOptionsCompat = KernelOptions;
export type KernelHooks = { onAppStateChanged?: (appId: string, status: string) => void };

type CapabilityExecutor = (input: unknown) => Promise<unknown> | unknown;

export class RuntimeKernel {
  private state: RuntimeKernelState = "CREATED";
  private readonly modules = new Map<string, KernelModule>();
  private readonly moduleDependencies = new Map<string, string[]>();
  private readonly moduleHealth = new Map<string, "ok" | "error">();
  private readonly executors = new Map<string, CapabilityExecutor>();
  private shutdownErrors: Array<{ module: string; error: unknown }> = [];

  readonly config: KernelConfig;
  readonly context: KernelContext;
  readonly routeRegistry = new RouteRegistry();
  private readonly hooks: KernelHooks;

  constructor(hooksOrConfig: KernelConfig & KernelHooks = {}, options: KernelOptions = {}) {
    // Compat: new RuntimeKernel() | new RuntimeKernel({onAppStateChanged}) |
    // new RuntimeKernel({}, {config:{grants}, modules, observability})
    const first = hooksOrConfig ?? {};
    const mergedConfig: KernelConfig = {
      ...(first as KernelConfig),
      ...(options.config ?? {}),
    };
    if (mergedConfig.logLevel === undefined) mergedConfig.logLevel = "info";
    if (mergedConfig.environment === undefined) mergedConfig.environment = "development";
    this.config = mergedConfig;
    this.hooks = {
      ...(first.onAppStateChanged ? { onAppStateChanged: first.onAppStateChanged } : {}),
      ...(mergedConfig.onAppStateChanged ? { onAppStateChanged: mergedConfig.onAppStateChanged } : {}),
    };
    // Merge hooks into context config so modules can read onAppStateChanged if needed
    this.context = new KernelContext({ ...mergedConfig, ...(this.hooks.onAppStateChanged ? { onAppStateChanged: this.hooks.onAppStateChanged } : {}) });

    // Observability seams FIRST (T-EXT-02) so any module can consume ctx.logger/metrics/tracer
    new ObservabilityModule(options.observability ?? {}, this.config.logLevel).register(this.context);

    const modules = options.modules ?? defaultModules();
    for (const module of modules) {
      this.install(module);
    }

    this.applyExternalGrants(this.config.grants);
  }

  private applyExternalGrants(grants: KernelConfig["grants"]): void {
    if (!grants) return;
    for (const grant of grants) {
      this.context.permissions.grant(grant.permission, grant.tenant, grant.app);
    }
  }

  // ─── State ───

  get stateMachineState(): RuntimeKernelState {
    return this.state;
  }

  /** Alias canonique. */
  get stateValue(): RuntimeKernelState {
    return this.state;
  }

  /**
   * @deprecated Compat legacy — `phaseState` minuscule (ex. "stopped").
   * Préférer `stateMachineState` (contrat contracts/runtime.ts).
   */
  get phaseState(): string {
    return this.state.toLowerCase();
  }

  get stateDetail(): RuntimeKernelState {
    return this.state;
  }

  get container() {
    return this.context.container;
  }

  get logger(): Logger {
    return this.context.logger;
  }

  get metrics(): Metrics {
    return this.context.metrics;
  }

  get tracing(): Trace {
    return this.context.tracer;
  }

  get moduleContext(): KernelContext {
    return this.context;
  }

  // ─── Facade backward-compat sur les services modules ───

  get store() {
    return this.context.eventStore;
  }

  get eventStore() {
    return this.context.eventStore;
  }

  get permissions() {
    return this.context.permissions;
  }

  get bus() {
    return this.context.events;
  }

  get events() {
    return this.context.events;
  }

  get authz() {
    return this.context.authorization;
  }

  get authorization() {
    return this.context.authorization;
  }

  get capabilities() {
    return this.context.capabilities;
  }

  get eventSchemas() {
    return this.context.eventSchemas;
  }

  // ─── Module system (ADR-0002) ───

  install(module: KernelModule): this {
    if (this.modules.has(module.name)) {
      throw new RegistrationError(`Module already installed: ${module.name}`, { name: module.name });
    }
    if (this.state === "RUNNING" || this.state === "INITIALIZING" || this.state === "READY" || this.state === "STOPPING") {
      throw new RegistrationError(
        `Cannot install module "${module.name}" after kernel is initialized or running (state=${this.state})`,
        { name: module.name, state: this.state },
      );
    }
    module.register(this.context);
    this.modules.set(module.name, module);
    this.moduleDependencies.set(module.name, [...(module.dependencies ?? [])]);
    this.moduleHealth.set(module.name, "ok");
    return this;
  }

  /** Alias historique (stub) → install. */
  registerModule(module: KernelModule): void {
    this.install(module);
  }

  listModules(): string[] {
    return Array.from(this.modules.keys());
  }

  // ─── Lifecycle 7 états ───

  async initialize(): Promise<void> {
    if (this.state !== "CREATED" && this.state !== "STOPPED" && this.state !== "FAILED") {
      throw new LifecycleError(`Cannot initialize kernel from state "${this.state}"`, { state: this.state });
    }
    this.state = "INITIALIZING";
    try {
      const ordered = this.getOrderedModules();
      for (const mod of ordered) {
        this.moduleHealth.set(mod.name, "ok");
        try {
          if (mod.boot) {
            await mod.boot(this.context);
          } else {
            const legacyInit = (mod as unknown as { initialize?: (ctx?: unknown) => unknown }).initialize;
            if (legacyInit) await legacyInit.call(mod, this.context);
          }
        } catch (error) {
          this.moduleHealth.set(mod.name, "error");
          throw error;
        }
      }
      this.state = "READY";
    } catch (error) {
      this.state = "FAILED";
      throw asKernelError(error);
    }
  }

  async start(): Promise<void> {
    if (this.state === "RUNNING") return;
    if (this.state === "INITIALIZING" || this.state === "STOPPING") {
      throw new RegistrationError(`Cannot start kernel while state is "${this.state}"`, { state: this.state });
    }
    if (this.state !== "READY") {
      await this.initialize();
    }
    // start hooks modules
    try {
      for (const mod of this.getOrderedModules()) {
        if (mod.start) {
          try {
            await mod.start(this.context);
          } catch (error) {
            this.moduleHealth.set(mod.name, "error");
            throw error;
          }
        }
      }
    } catch (error) {
      this.state = "FAILED";
      throw asKernelError(error);
    }
    this.state = "RUNNING";
    await this.bootstrap();
  }

  async stop(): Promise<void> {
    if (this.state === "STOPPED" || this.state === "STOPPING") return;
    // STOPPING émis (contrat contracts/runtime.ts) — même depuis READY/FAILED
    this.state = "STOPPING";
    this.shutdownErrors = [];

    // Drain gracieux des apps actives/ready
    for (const entry of this.context.apps.entries()) {
      const status = entry.lifecycle.status;
      if (status === "active" || status === "ready") {
        try {
          await entry.lifecycle.drain();
          this.hooks.onAppStateChanged?.(entry.manifest.id, "disabled");
        } catch (error) {
          try {
            this.logger.warn("Failed to drain app", { app: entry.manifest.id, error: asKernelError(error).message });
          } catch {
            // logger indisponible → ignore
          }
        }
      }
    }

    for (const mod of this.getOrderedModules().reverse()) {
      const shutdown = (mod as unknown as { stop?: (ctx: unknown) => unknown; shutdown?: (ctx?: unknown) => unknown }).stop
        ?? (mod as unknown as { shutdown?: (ctx?: unknown) => unknown }).shutdown;
      if (!shutdown) continue;
      try {
        await (shutdown as (ctx: unknown) => unknown).call(mod, this.context);
      } catch (error) {
        const err = asKernelError(error);
        this.shutdownErrors.push({ module: mod.name, error: err });
        this.moduleHealth.set(mod.name, "error");
        try {
          this.logger.warn(`Module shutdown failed: ${mod.name}`, { error: err.message });
        } catch {
          // ignore
        }
      }
    }
    this.state = "STOPPED";
  }

  // ─── Apps ───

  register(manifest: ApplicationManifest, callbacks: LifecycleCallbacks = {}): void {
    Invariants.manifest(manifest);
    const parsed = ApplicationManifestSchema.safeParse(manifest);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
      throw new RegistrationError(`Invalid application manifest for "${manifest.id}": ${issues}`, {
        appId: manifest.id,
      });
    }
    if (this.context.apps.has(manifest.id)) {
      throw new RegistrationError(`Application already registered: ${manifest.id}`, { appId: manifest.id });
    }
    this.context.apps.register(manifest, callbacks);

    // Capabilities dérivées du manifest : entry = entrypoint#capId, permissions filtrées execute.
    // Le préfixe attendu suit la même dérivation domaine/resource que le
    // boundary (capabilityPermissionPrefix) : "@apps/<app>" mappe vers le
    // domaine métier, les owners simples restent tels quels.
    const caps = (manifest.capabilities ?? []) as Array<{ id: string; version: string }>;
    const permEntries = (manifest.permissions ?? []) as Array<string | { category?: string; permission?: string }>;
    for (const cap of caps) {
      const expectedPrefix = RuntimeKernel.capabilityPermissionPrefix(manifest.id, cap.id);
      const perms = permEntries
        .filter((p): p is { category?: string; permission?: string } => typeof p === "object" && p !== null)
        .filter((p) => p.category === "capability" && (p.permission ?? "").startsWith(expectedPrefix))
        .map((p) => p.permission as string);
      try {
        this.context.capabilities.register({
          id: cap.id,
          ownerApp: manifest.id,
          version: cap.version ?? "1.0.0",
          entry: `${manifest.runtime.entrypoint}#${cap.id}`,
          permissions: perms,
        });
      } catch (error) {
        throw asKernelError(error);
      }
    }
    // Event schemas : ownership single-owner (domain.events ou direct events)
    const domainEvents = typeof manifest.domain === "object" && manifest.domain !== null && Array.isArray(manifest.domain.events)
      ? manifest.domain.events
      : undefined;
    const directEvents = Array.isArray(manifest.events)
      ? manifest.events
      : typeof manifest.events === "object" && manifest.events !== null && Array.isArray(manifest.events.publishes)
        ? manifest.events.publishes
        : undefined;
    const eventTypes: string[] = domainEvents ?? directEvents ?? [];
    for (const eventType of eventTypes) {
      this.context.eventSchemas.register({
        type: eventType,
        version: "1.0.0",
        ownerApp: manifest.id,
        schema: {},
      });
    }
  }

  has(id: string): boolean {
    return this.context.apps.has(id);
  }

  getStatus(id: string): string | undefined {
    return this.context.apps.getStatus(id);
  }

  listApps() {
    return this.context.apps.entries();
  }

  async bootstrap(): Promise<void> {
    for (const entry of this.context.apps.entries()) {
      try {
        this.hooks.onAppStateChanged?.(entry.manifest.id, "initializing");
        await entry.lifecycle.initialize();
        this.hooks.onAppStateChanged?.(entry.manifest.id, entry.lifecycle.status);
      } catch {
        // initialize() passe déjà en degraded + onDegraded ; containment : on continue
        this.hooks.onAppStateChanged?.(entry.manifest.id, entry.lifecycle.status);
      }
    }
  }

  async degrade(appId: string, error: unknown): Promise<void> {
    const entry = this.context.apps.get(appId);
    if (!entry) throw new RegistrationError(`Unknown application: ${appId}`, { appId });
    await entry.lifecycle.degrade(error);
    this.hooks.onAppStateChanged?.(appId, entry.lifecycle.status);
  }

  async disable(appId: string): Promise<void> {
    const entry = this.context.apps.get(appId);
    if (!entry) throw new RegistrationError(`Unknown application: ${appId}`, { appId });
    await entry.lifecycle.disable();
    this.hooks.onAppStateChanged?.(appId, entry.lifecycle.status);
  }

  // ─── Capabilities (boundary Flow B) ───

  registerCapability(ownerApp: string, entry: Omit<CapabilityEntry, "ownerApp">): void {
    this.context.capabilities.register({ ownerApp, ...entry });
  }

  resolveCapability(id: string, version?: string) {
    return this.context.capabilities.resolve(id, version);
  }

  registerCapabilityExecutor(capabilityId: string, executor: CapabilityExecutor): void {
    const entry = this.context.capabilities.resolve(capabilityId);
    if (!entry) {
      throw new CapabilityError(`Unknown capability: ${capabilityId}`, { capabilityId });
    }
    this.executors.set(capabilityId, executor);
    (entry as unknown as { executor: CapabilityExecutor }).executor = executor;
  }

  bindCapabilityContract(
    capabilityId: string,
    ownerApp: string,
    contract: { inputValidator?: PayloadValidator; outputValidator?: PayloadValidator },
  ): void {
    if (contract.inputValidator !== undefined && typeof (contract.inputValidator as { safeParse?: unknown }).safeParse !== "function") {
      throw new CapabilityError(`Invalid inputValidator for capability ${capabilityId}: missing safeParse`, { capabilityId });
    }
    if (contract.outputValidator !== undefined && typeof (contract.outputValidator as { safeParse?: unknown }).safeParse !== "function") {
      throw new CapabilityError(`Invalid outputValidator for capability ${capabilityId}: missing safeParse`, { capabilityId });
    }
    const updated = this.context.capabilities.bindContract(capabilityId, ownerApp, contract);
    if (!updated) {
      throw new CapabilityError(`Unknown capability: ${capabilityId} (owner ${ownerApp})`, { capabilityId, ownerApp });
    }
  }

  registerEventSchema(entry: {
    type: string;
    version: string;
    ownerApp: string;
    validator?: PayloadValidator;
    schema?: PayloadValidator | Record<string, unknown>;
    payloadSchema?: PayloadValidator;
  }): void {
    const payloadSchema = entry.payloadSchema ?? (entry.validator as PayloadValidator | undefined) ?? (entry.schema as PayloadValidator | undefined);
    this.context.eventSchemas.register({
      type: entry.type,
      version: entry.version,
      ownerApp: entry.ownerApp,
      schema: {},
      ...(payloadSchema && typeof (payloadSchema as { safeParse?: unknown }).safeParse === "function"
        ? { payloadSchema: payloadSchema as PayloadValidator }
        : {}),
    });
  }

  async executeCapability(
    capabilityId: string,
    callerApp: string,
    tenant: TenantIdentity,
    input: unknown,
  ): Promise<unknown> {
    const entry = this.context.capabilities.resolve(capabilityId);
    if (!entry) {
      throw new CapabilityError(`Unknown capability: ${capabilityId}`, { capabilityId });
    }
    // 1. permission execute:<tenant> — le domaine est dérivé de l'entry, pas
    // du caller. Les ids techniques "@apps/<app>" mappent vers le domaine
    // métier (1er segment de la capability : "portfolio.vendable.search" →
    // domaine "portfolio"), les owners simples ("identity") restent tels quels.
    const required = `${RuntimeKernel.capabilityPermissionPrefix(entry.ownerApp, entry.id)}execute:tenant`;
    let allowed: boolean;
    try {
      allowed = this.context.permissions.check(required as `${string}:${string}:${string}:${string}`, tenant, callerApp);
    } catch {
      allowed = false;
    }
    if (!allowed) {
      throw new AuthorizationError(`Permission denied: ${callerApp} cannot execute ${capabilityId}`, {
        capabilityId,
        callerApp,
      });
    }
    // 2. input contract
    if (entry.inputValidator && !entry.inputValidator.safeParse(input).success) {
      throw new CapabilityError(`Capability [${capabilityId}] input contract violated.`, { capabilityId });
    }
    // 3. trace + metrics
    const tracer = this.context.tracer;
    const span = tracer.begin("capability.execute", { actor: callerApp, capability: capabilityId });
    try {
      const executor = this.executors.get(capabilityId)
        ?? (entry as unknown as { executor?: CapabilityExecutor }).executor;
      if (!executor) {
        throw new CapabilityError(`Capability [${capabilityId}] has no registered provider executor.`, { capabilityId });
      }
      const output = await executor(input);
      if (entry.outputValidator && !entry.outputValidator.safeParse(output).success) {
        throw new CapabilityError(`Capability [${capabilityId}] output contract violated.`, { capabilityId });
      }
      span.end("ok");
      try {
        this.context.metrics.increment("capability.execute");
      } catch {
        // metrics optionnelle
      }
      return output;
    } catch (error) {
      if (error instanceof CapabilityError || error instanceof AuthorizationError) {
        try { span.end("error", error); } catch { /* ignore */ }
        throw error;
      }
      try { span.end("error", error); } catch { /* ignore */ }
      throw asKernelError(error);
    }
  }

  /**
   * Préfixe `domaine:resource:` d'une capability pour la grammaire
   * `domaine:resource:action:scope`. Les owners simples ("identity") donnent
   * `"identity:user.lookup:"` ; les ids techniques ("@apps/portfolio") se
   * replient sur le domaine métier porté par la capability
   * ("portfolio.vendable.search" → `"portfolio:vendable.search:"`).
   */
  static capabilityPermissionPrefix(ownerApp: string, capabilityId: string): `${string}:${string}:` {
    if (!ownerApp.includes("@") && !ownerApp.includes("/")) {
      return `${ownerApp}:${capabilityId}:` as `${string}:${string}:`;
    }
    const [domain = ownerApp, ...rest] = capabilityId.split(".");
    const resource = rest.length > 0 ? rest.join(".") : capabilityId;
    return `${domain}:${resource}:` as `${string}:${string}:`;
  }

  // ─── Router & health (non-stub) ───

  mountRouter(prefix: string, router: unknown): void {
    const routes = this.extractRoutes(router);
    const appId = this.deriveAppId(prefix);
    for (const route of routes) {
      const path = this.joinPrefix(prefix, route.path as string);
      const method = (route.method as string ?? "GET").toUpperCase() as Parameters<RouteRegistry["registerRoute"]>[0]["method"];
      this.routeRegistry.registerRoute({
        id: `${appId}:${method}:${path}`,
        appId,
        method,
        path,
        handler: `${appId}:router`,
      });
    }
  }

  private deriveAppId(prefix: string): string {
    // "/tenants/acme/identity" → "identity" ; "/api" → "api"
    const segs = prefix.split("/").filter(Boolean);
    return segs[segs.length - 1] ?? "app";
  }

  private extractRoutes(router: unknown): Array<{ path: string; method?: string; [k: string]: unknown }> {
    if (!router || typeof router !== "object") return [];
    const r = router as Record<string, unknown>;
    if (Array.isArray(r["routes"])) return r["routes"] as Array<{ path: string }>;
    // @mosaix/http Router API (http.ts:77) — le seul Router réel du repo
    if (typeof r["getRoutes"] === "function") {
      return (r["getRoutes"] as () => Array<{ path: string; method?: string }>)();
    }
    if (typeof r["listRoutes"] === "function") {
      return (r["listRoutes"] as () => Array<{ path: string }>)();
    }
    if (typeof r["path"] === "string") return [r as unknown as { path: string }];
    return [];
  }

  private joinPrefix(prefix: string, path: string): string {
    if (!prefix) return path;
    const p = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const s = path.startsWith("/") ? path : `/${path}`;
    return `${p}${s}`;
  }

  getModuleHealth(): Record<string, { name: string; status: "OK" | "FAIL"; details?: string }> {
    const health: Record<string, { name: string; status: "OK" | "FAIL"; details?: string }> = {};
    for (const [name] of this.modules.entries()) {
      const raw = this.moduleHealth.get(name) ?? "ok";
      health[name] = { name, status: raw === "ok" ? "OK" : "FAIL" };
    }
    return health;
  }

  getModuleDiagnostics(moduleName: string): Record<string, unknown> | undefined {
    const module = this.modules.get(moduleName) as unknown as { diagnostics?: () => Record<string, unknown> } | undefined;
    return module?.diagnostics?.();
  }

  getAllModuleHealth(): Record<string, { status: string; lastCheck: number; details: Record<string, unknown> | undefined }> {
    const result: Record<string, { status: string; lastCheck: number; details: Record<string, unknown> | undefined }> = {};
    for (const [name, mod] of this.modules.entries()) {
      const custom = (mod as unknown as { health?: () => { status?: string; lastCheck?: number; details?: Record<string, unknown> } }).health?.();
      result[name] = {
        status: custom?.status ?? (this.moduleHealth.get(name) ?? "ok"),
        lastCheck: custom?.lastCheck ?? Date.now(),
        details: custom?.details,
      };
    }
    return result;
  }

  // ─── Tri topologique avec détection de cycle ───

  private getOrderedModules(): KernelModule[] {
    const resolved: KernelModule[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (mod: KernelModule): void => {
      if (visited.has(mod.name)) return;
      if (visiting.has(mod.name)) {
        throw new LifecycleError(`Circular module dependency detected: ${mod.name}`, { moduleId: mod.name });
      }
      visiting.add(mod.name);
      for (const depName of this.moduleDependencies.get(mod.name) ?? mod.dependencies ?? []) {
        const dep = this.modules.get(depName);
        if (!dep) {
          throw new LifecycleError(`Module "${mod.name}" depends on unknown module "${depName}"`, {
            moduleId: mod.name,
            dependency: depName,
          });
        }
        visit(dep);
      }
      visiting.delete(mod.name);
      visited.add(mod.name);
      resolved.push(mod);
    };

    for (const mod of this.modules.values()) {
      visit(mod);
    }
    return resolved;
  }
}
