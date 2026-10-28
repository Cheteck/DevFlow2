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
} from "./kernel-errors.js";
export type { KernelErrorDetails } from "./kernel-errors.js";

// Identity & traçabilité
export { createExecutionContext, describeTenant } from "./identity.js";
export type {
  ApplicationIdentity,
  CapabilityIdentity,
  ExecutionContext,
} from "./identity.js";

// Observability
export {
  ConsoleLogger,
  InMemoryMetrics,
  InMemoryTracer,
} from "./observability.js";
export type {
  Logger,
  LogRecord,
  LogLevel,
  Metrics,
  Trace,
  TraceSpan,
  TraceStatus,
  KernelTrace,
} from "./observability.js";

// Kernel module system
export type {
  KernelConfig,
  KernelContext,
  KernelModule,
  KernelServices,
  KernelServiceName,
} from "./kernel-module.js";
export { KERNEL_SERVICE_NAMES } from "./kernel-module.js";

// App registry
export { AppRegistry, ApplicationRegistry } from "./app-registry.js";

export { AppLifecycle } from "./lifecycle.js";
export type {
  LifecycleCallbacks,
  LifecycleObserver,
  LifecycleEvent,
} from "./lifecycle.js";

export { CapabilityRegistry } from "./capability-registry.js";
export { capabilityRegistry } from "./capability.js";
export type {
  CapabilityEntry,
  CapabilityAvailability,
} from "./capability-registry.js";

export { EventSchemaRegistry } from "./event-schema-registry.js";
export type {
  EventSchemaEntry,
  PayloadValidator,
} from "./event-schema-registry.js";

export { DomainEventBus, EventStore } from "./event-bus.js";
export type {
  EventHandler,
  EventStoreEntry,
  RetryPolicy,
  DeadLetterEntry,
} from "./event-bus.js";

export { PermissionRegistry, AuthorizationEngine } from "./permission.js";
export type { RegisteredPermissionDefinition } from "./permission.js";

export { RuntimeKernel } from "./kernel.js";
export type { KernelHooks, KernelOptions } from "./kernel.js";

export {
  CapabilitiesModule,
  EventsModule,
  PermissionsModule,
  ObservabilityModule,
  PluginModule,
  InfrastructureModule,
  DatabaseModule,
  defaultModules,
} from "./modules/index.js";
export type {
  ObservabilityModuleOptions,
  InfrastructureModuleOptions,
  DatabaseModuleOptions,
  DatabaseService,
} from "./modules/index.js";
export { PLUGIN_SERVICE } from "./modules/index.js";

// ─── Plugin Registry (T-EXT-04) ───────────────────────────────
export { PluginRegistry, extensionPointKey } from "./plugin/plugin-registry.js";
export type { PluginEntry } from "./plugin/plugin-registry.js";
export {
  PluginError,
  PluginRegistrationError,
  PluginLifecycleError,
} from "./plugin/plugin-errors.js";

// ─── Dedicated Theme System (@mosaix/theme) ────────────────
export * from "@mosaix/theme";

export * from "./database-resolver.js";

export * from "./component-lifecycle.js";

export * from "./context-registry.js";
export * from "./composition-resolver.js";
export * from "./composition-override-manager.js";

export * from "./application-runtime.js";
export { ApplicationDiscovery } from "./app-discovery.js";

// Env module (AdonisJS-inspired)
export { Env, EnvManager } from "./env/env.js";
export {
  baseEnvSchema,
  validateEnv,
  resolvePort,
  loadEnvFile,
} from "./env/env.schema.js";
export type { BaseEnv, NormalizedEnv } from "./env/env.schema.js";

// Service Providers (AdonisJS-inspired) & IoC Container
export { BaseServiceProvider } from "./providers/base-service-provider.js";
export * from "@mosaix/container";

// HTTP & Authorization (AdonisJS-inspired)
export { HttpContext } from "./http/http-context.js";
export { ExceptionHandler } from "./http/exception-handler.js";
export type { HttpError } from "./http/exception-handler.js";
export { MiddlewarePipeline } from "./http/middleware-pipeline.js";
export type { HttpHandler, MiddlewareFn } from "./http/middleware-pipeline.js";
export { BasePolicy } from "./auth/policy.js";

// Shell Registry
export { shellRegistry } from "./shell-registry.js";
export type {
  ShellAction,
  AdminPage,
  ContextualActionsContext,
  ShellContextualContribution,
  NavigationItemContribution,
} from "./shell-registry.js";

// Built-in Kernel Modules & Services
export * from "./modules/index.js";

// Effective Permission Resolver & Value Objects
export {
  EffectivePermissionResolver,
  UserAuthorizationContext,
  effectivePermissionResolver,
  matchPermissionPattern,
} from "./effective-permission-resolver.js";
export type {
  PermissionEffect,
  PermissionSource,
  PermissionDecision,
  ResolverContext,
  RolePermissionRule,
  UserPermissionOverride,
} from "./effective-permission-resolver.js";

export { Money, Timestamp } from "./value-objects.js";

// Platform Settings & BAC Orchestration
export * from "./platform-settings.js";
export * from "./shell-user-state.js";
export * from "./shell-entry-policy.js";
export * from "./request-diagnostics-store.js";
