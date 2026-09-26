/**
 * @mosaix/core — index
 */

// Errors
export {
  KernelError,
  RegistrationError,
  LifecycleError,
  AuthorizationError,
  CapabilityError,
  EventError,
  ValidationError,
  ServiceNotInstalledError,
  asKernelError,
} from "./kernel-errors";
export type { KernelErrorDetails } from "./kernel-errors";

// Identity & traçabilité
export { createExecutionContext, describeTenant } from "./identity";
export type {
  ApplicationIdentity,
  CapabilityIdentity,
  ExecutionContext,
} from "./identity";

// Observability
export {
  ConsoleLogger,
  InMemoryMetrics,
  InMemoryTracer,
} from "./observability";
export type {
  Logger,
  LogRecord,
  LogLevel,
  Metrics,
  Trace,
  TraceSpan,
  TraceStatus,
  KernelTrace,
} from "./observability";

// Kernel module system
export type {
  KernelConfig,
  KernelContext,
  KernelModule,
  KernelServices,
  KernelServiceName,
} from "./kernel-module";
export { KERNEL_SERVICE_NAMES } from "./kernel-module";

// App registry
export { AppRegistry, ApplicationRegistry } from "./app-registry";

export { AppLifecycle } from "./lifecycle";
export type {
  LifecycleCallbacks,
  LifecycleObserver,
  LifecycleEvent,
} from "./lifecycle";

export { CapabilityRegistry } from "./capability-registry";
export { capabilityRegistry } from "./capability";
export type {
  CapabilityEntry,
  CapabilityAvailability,
} from "./capability-registry";

export { EventSchemaRegistry } from "./event-schema-registry";
export type {
  EventSchemaEntry,
  PayloadValidator,
} from "./event-schema-registry";

export { DomainEventBus, EventStore } from "./event-bus";
export type {
  EventHandler,
  EventStoreEntry,
  RetryPolicy,
  DeadLetterEntry,
} from "./event-bus";

export { PermissionRegistry, AuthorizationEngine } from "./permission";
export type { RegisteredPermissionDefinition } from "./permission";

export { RuntimeKernel } from "./kernel";
export type { KernelHooks, KernelOptions } from "./kernel";

export {
  CapabilitiesModule,
  EventsModule,
  PermissionsModule,
  ObservabilityModule,
  PluginModule,
  InfrastructureModule,
  DatabaseModule,
  defaultModules,
} from "./modules";
export type {
  ObservabilityModuleOptions,
  InfrastructureModuleOptions,
  DatabaseModuleOptions,
  DatabaseService,
} from "./modules";
export { PLUGIN_SERVICE } from "./modules";

// ─── Plugin Registry (T-EXT-04) ───────────────────────────────
export { PluginRegistry, extensionPointKey } from "./plugin/plugin-registry";
export type { PluginEntry } from "./plugin/plugin-registry";
export {
  PluginError,
  PluginRegistrationError,
  PluginLifecycleError,
} from "./plugin/plugin-errors";

// ─── Theme Resolution ────────────────────────────────
export { ThemeTargetRegistry } from "./theme/theme-target-registry";
export type {
  ThemeTargetRegistration,
  ThemeTargetCapabilities,
} from "./theme/theme-target-registry";
export {
  ThemeResolver,
  createThemeResolver,
  DEFAULT_THEME_PRECEDENCE,
  resolveTarget,
  resolveAssignment,
  resolveThemeId,
  resolveMode,
  resolveInheritance,
  satisfiesVersion,
} from "./theme/theme-resolver";
export type {
  ThemeResolverOptions,
  ThemeResolutionOutcome,
  TargetStepResult,
  ThemeIdDecision,
  ModeStepResult,
  ThemeInheritanceResolverLike,
  InheritanceStepDeps,
} from "./theme/theme-resolver";

export {
  ThemeInheritanceResolver,
  resolveThemeInheritance,
} from "./theme/theme-inheritance-resolver";
export type {
  ThemeManifestLookup,
  ThemeInheritanceResolverOptions,
} from "./theme/theme-inheritance-resolver";

export {
  ThemeError,
  ThemeNotFoundError,
  ThemeCycleError,
  ThemeVersionError,
  ThemeValidationError,
  ThemeInjectionError,
  ThemeCompatibilityError,
  ThemeAuthorizationError,
} from "./theme/theme-errors";
export type { ThemeErrorCode } from "./theme/theme-errors";

export { InMemoryThemeAssignmentsStore } from "./theme/in-memory-theme-assignments-store";
export type {
  ThemeMutationListener,
  InMemoryThemeAssignmentsStoreOptions,
} from "./theme/in-memory-theme-assignments-store";

// ─── Theme Compilation, Cache, Injection & Runtime ────────────────
export { compile, THE_GROUP_CSS_NAMES } from "./theme/theme-compiler";

export {
  ThemeCache,
  toThemeCacheKey,
  THEME_CACHE_DEFAULT_MAX,
} from "./theme/theme-cache";
export type { ThemeCacheKey } from "./theme/theme-cache";

export {
  ThemeInjector,
  diffCompiledTheme,
  INJECTOR_BATCH_THRESHOLD,
} from "./theme/theme-injector";
export type { ThemeRoot, CssStyleHost } from "./theme/theme-injector";

export {
  ThemeRuntime,
  createThemeRuntime,
  THEME_CHANGED_EVENT_VERSION,
  THEME_RUNTIME_OWNER_APP,
} from "./theme/theme-runtime";
export type {
  ThemeChangedPublisher,
  ThemeApplyOutcome,
  ThemeRuntimeOptions,
  ThemeRuntimeFactoryOptions,
} from "./theme/theme-runtime";

export * from "./database-resolver";

export * from "./component-lifecycle";

export * from "./context-registry";
export * from "./composition-resolver";
export * from "./composition-override-manager.js";

export * from "./application-runtime";
export { ApplicationDiscovery } from "./app-discovery";

export { resolveSlot, SHELL_ROUTES, isShellRoute } from "./theme/resolve-slot";
export type {
  SlotResolutionContext,
  SlotResolutionResult,
} from "./theme/resolve-slot";
export { deepMergeTokens } from "./theme/resolve-tokens";
export { ThemeDiscovery } from "./theme/theme-discovery";
export type { DiscoveredThemeInfo } from "./theme/theme-discovery";

// Env module (AdonisJS-inspired)
export { Env, EnvManager } from "./env/env";
export {
  baseEnvSchema,
  validateEnv,
  resolvePort,
  loadEnvFile,
} from "./env/env.schema";
export type { BaseEnv, NormalizedEnv } from "./env/env.schema";

// Service Providers (AdonisJS-inspired) & IoC Container
export { BaseServiceProvider } from "./providers/base-service-provider";
export * from "@mosaix/container";

// HTTP & Authorization (AdonisJS-inspired)
export { HttpContext } from "./http/http-context";
export { ExceptionHandler } from "./http/exception-handler";
export type { HttpError } from "./http/exception-handler";
export { MiddlewarePipeline } from "./http/middleware-pipeline";
export type { HttpHandler, MiddlewareFn } from "./http/middleware-pipeline";
export { BasePolicy } from "./auth/policy";

// Shell Registry
export { shellRegistry } from "./shell-registry";
export type {
  ShellAction,
  AdminPage,
  ContextualActionsContext,
  ShellContextualContribution,
  NavigationItemContribution,
} from "./shell-registry";

// Built-in Kernel Modules & Services
export * from "./modules/index";

// Theme persistence + BAC targets
export { PostgresThemeAssignmentsStore } from "./theme/postgres-theme-assignments-store";
export { ThemeAssignmentsMigrationProvider } from "./theme/theme-assignments-migration";
export {
  BAC_THEME_TARGETS,
  registerBacThemeTargets,
} from "./theme/bac-theme-targets";

// Effective Permission Resolver & Value Objects
export {
  EffectivePermissionResolver,
  UserAuthorizationContext,
  effectivePermissionResolver,
  matchPermissionPattern,
} from "./effective-permission-resolver";
export type {
  PermissionEffect,
  PermissionSource,
  PermissionDecision,
  ResolverContext,
  RolePermissionRule,
  UserPermissionOverride,
} from "./effective-permission-resolver";

export { Money, Timestamp } from "./value-objects";

// Platform Settings & BAC Orchestration
export * from "./platform-settings.js";
export * from "./shell-user-state.js";
export * from "./shell-entry-policy.js";
export * from "./request-diagnostics-store.js";
