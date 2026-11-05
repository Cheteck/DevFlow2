/**
 * @mosaix/sdk — Application SDK for Bounded Application Contexts
 */

import { RuntimeKernel } from "@mosaix/core";
import { Container } from "@mosaix/container";
import { Router } from "@mosaix/http";
import type {
  ApplicationManifest,
  MosaixEventEnvelope,
  TenantIdentity,
} from "@mosaix/contracts";
import type { PayloadValidator } from "@mosaix/core";
import type { FeatureFlagsPort, FeatureFlagUserContext } from "@mosaix/ports-feature-flags";
import { uuidV7 } from "@mosaix/types";

// ============================================================================
// 1. RUNTIME CLIENT & TRANSPORT PORTS (Decoupling SDK from RuntimeKernel)
// ============================================================================

export interface CapabilityInvokerPort {
  executeCapability(
    capabilityId: string,
    callerApp: string,
    tenant: TenantIdentity,
    input: unknown,
  ): Promise<unknown>;
}

export interface CapabilityProviderPort {
  registerCapabilityExecutor(
    capabilityId: string,
    executor: (input: unknown) => Promise<unknown> | unknown,
  ): void;
  bindCapabilityContract?(
    capabilityId: string,
    ownerApp: string,
    contract: { inputValidator?: PayloadValidator; outputValidator?: PayloadValidator },
  ): void;
}

export interface EventPublisherPort {
  publishEvent(envelope: MosaixEventEnvelope, senderApp: string): Promise<void>;
  registerEventSchema?(entry: {
    type: string;
    version: string;
    ownerApp: string;
    schema?: PayloadValidator | Record<string, unknown>;
    payloadSchema?: PayloadValidator;
  }): void;
}

/**
 * RuntimeClient: Minimal transport abstraction required by MosaixApp.
 * Enables Shared Runtime (KernelRuntimeClient), Isolated Runtime (IPC/Process),
 * and External Runtime (HTTP/Remote).
 */
export interface RuntimeClient
  extends CapabilityInvokerPort,
    CapabilityProviderPort,
    EventPublisherPort {
  register?(manifest: ApplicationManifest): void;
}

/**
 * Default In-Process Kernel Adapter for Shared Runtime mode.
 */
export class KernelRuntimeClient implements RuntimeClient {
  constructor(public readonly kernel: RuntimeKernel) {}

  register(manifest: ApplicationManifest): void {
    this.kernel.register(manifest);
  }

  async executeCapability(
    capabilityId: string,
    callerApp: string,
    tenant: TenantIdentity,
    input: unknown,
  ): Promise<unknown> {
    return this.kernel.executeCapability(capabilityId, callerApp, tenant, input);
  }

  registerCapabilityExecutor(
    capabilityId: string,
    executor: (input: unknown) => Promise<unknown> | unknown,
  ): void {
    this.kernel.registerCapabilityExecutor(capabilityId, executor);
  }

  bindCapabilityContract(
    capabilityId: string,
    ownerApp: string,
    contract: { inputValidator?: PayloadValidator; outputValidator?: PayloadValidator },
  ): void {
    this.kernel.bindCapabilityContract(capabilityId, ownerApp, contract);
  }

  async publishEvent(envelope: MosaixEventEnvelope, senderApp: string): Promise<void> {
    await this.kernel.context.events.publish(envelope, senderApp);
  }

  registerEventSchema(entry: {
    type: string;
    version: string;
    ownerApp: string;
    schema?: PayloadValidator | Record<string, unknown>;
    payloadSchema?: PayloadValidator;
  }): void {
    this.kernel.registerEventSchema({
      type: entry.type,
      version: entry.version,
      ownerApp: entry.ownerApp,
      ...(entry.schema !== undefined ? { schema: entry.schema } : {}),
      ...(entry.payloadSchema !== undefined ? { payloadSchema: entry.payloadSchema } : {}),
    });
  }
}

// ============================================================================
// 2. MOSAIX APPLICATION REGISTRATION & INTERFACES
// ============================================================================

export interface MosaixAppRegistration {
  manifest: ApplicationManifest;
  tenant: TenantIdentity;
}

export interface PublishEventOptions {
  correlationId?: string;
  causationId?: string;
  security?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * MosaixApp — The canonical Application Developer API.
 */
export class MosaixApp {
  readonly manifest: ApplicationManifest;
  readonly tenant: TenantIdentity;
  readonly client: RuntimeClient;

  /**
   * Backward compatibility getter: returns the underlying RuntimeKernel
   * if running with KernelRuntimeClient, or throws an explicit error in remote modes.
   */
  get kernel(): RuntimeKernel {
    if ("kernel" in this.client && (this.client as { kernel: RuntimeKernel }).kernel instanceof RuntimeKernel) {
      return (this.client as { kernel: RuntimeKernel }).kernel;
    }
    throw new Error(
      `[MosaixApp] The current RuntimeClient does not expose an in-process RuntimeKernel. Avoid direct kernel coupling.`,
    );
  }

  constructor(
    registration: MosaixAppRegistration,
    runtime: RuntimeClient | RuntimeKernel,
  ) {
    this.manifest = registration.manifest;
    this.tenant = registration.tenant;
    this.client =
      runtime instanceof RuntimeKernel
        ? new KernelRuntimeClient(runtime)
        : runtime;
  }

  static register(
    registration: MosaixAppRegistration,
    runtime: RuntimeClient | RuntimeKernel,
  ): MosaixApp {
    const client =
      runtime instanceof RuntimeKernel
        ? new KernelRuntimeClient(runtime)
        : runtime;
    client.register?.(registration.manifest);
    return new MosaixApp(registration, client);
  }

  /**
   * Namespaced Capabilities API
   */
  readonly capabilities = {
    invoke: async <TInput = unknown, TOutput = unknown>(
      capabilityId: string,
      input: TInput,
    ): Promise<TOutput> => {
      return this.client.executeCapability(
        capabilityId,
        this.manifest.id,
        this.tenant,
        input,
      ) as Promise<TOutput>;
    },
    provide: (
      capabilityId: string,
      executor: (input: unknown) => Promise<unknown> | unknown,
    ): void => {
      this.client.registerCapabilityExecutor(capabilityId, executor);
    },
    bindContract: (
      capabilityId: string,
      contract: { inputValidator?: PayloadValidator; outputValidator?: PayloadValidator },
    ): void => {
      this.client.bindCapabilityContract?.(capabilityId, this.manifest.id, contract);
    },
  };

  /**
   * Namespaced Events API
   */
  readonly events = {
    publish: async <TPayload = unknown>(
      type: string,
      version: string,
      payload: TPayload,
      options: PublishEventOptions = {},
    ): Promise<MosaixEventEnvelope> => {
      const envelope: MosaixEventEnvelope = {
        id: uuidV7(),
        type,
        version,
        source: { application: this.manifest.id },
        timestamp: new Date().toISOString(),
        payload,
        tenant: this.tenant,
        correlationId: options.correlationId,
        causationId: options.causationId,
        metadata: options.metadata,
        security: options.security,
      };

      await this.client.publishEvent(envelope, this.manifest.id);
      return envelope;
    },
    registerSchema: (entry: {
      type: string;
      version: string;
      schema?: PayloadValidator | Record<string, unknown>;
      payloadSchema?: PayloadValidator;
    }): void => {
      this.client.registerEventSchema?.({
        type: entry.type,
        version: entry.version,
        ownerApp: this.manifest.id,
        ...(entry.schema !== undefined ? { schema: entry.schema } : {}),
        ...(entry.payloadSchema !== undefined ? { payloadSchema: entry.payloadSchema } : {}),
      });
    },
  };

  // ── Backward-compatible Direct Methods ─────────────────────────────────────

  registerEventSchema(entry: {
    type: string;
    version: string;
    schema?: PayloadValidator | Record<string, unknown>;
    payloadSchema?: PayloadValidator;
  }): void {
    this.events.registerSchema(entry);
  }

  async publish(
    type: string,
    version: string,
    payload: unknown,
    options: PublishEventOptions = {},
  ): Promise<MosaixEventEnvelope> {
    return this.events.publish(type, version, payload, options);
  }

  provideCapability(
    capabilityId: string,
    executor: (input: unknown) => Promise<unknown> | unknown,
  ): void {
    this.capabilities.provide(capabilityId, executor);
  }

  async executeCapability(capabilityId: string, input: unknown): Promise<unknown> {
    return this.capabilities.invoke(capabilityId, input);
  }

  registerCapabilityContract(
    capabilityId: string,
    contract: { inputValidator?: PayloadValidator; outputValidator?: PayloadValidator },
  ): void {
    this.capabilities.bindContract(capabilityId, contract);
  }
}

export { RuntimeKernel };
export const SDK = { MosaixApp, RuntimeKernel, KernelRuntimeClient };

// Re-export Core Context, Types and Contracts
export type { TenantIdentity, ApplicationManifest, MosaixEventEnvelope };

// Re-export IoC Container primitives
export { Container } from "@mosaix/container";
export type { ServiceProvider } from "@mosaix/container";

// Re-export HTTP primitives
export { Controller, Router } from "@mosaix/http";
export type { HttpRequest, HttpResponse, RouteHandler, RouteDefinition } from "@mosaix/http";

// Re-export ORM models, traits and seeding utilities
export { Model, SoftDeleteTrait, TimestampableTrait, applyTraits } from "@mosaix/orm";
export { Seeder, Factory } from "@mosaix/orm";
export { hasMany } from "@mosaix/orm";
export type { RelationMetadata } from "@mosaix/orm";

// Re-export Saga Orchestration
export { WorkflowEngine } from "@mosaix/orchestration";

let globalFeatureFlagsPort: FeatureFlagsPort | null = null;

/**
 * registerFeatureFlagsProvider - Registers an active FeatureFlagsPort instance
 * for the process / SDK resolution.
 */
export function registerFeatureFlagsProvider(provider: FeatureFlagsPort | null): void {
  globalFeatureFlagsPort = provider;
}

/**
 * getFeatureFlagsProvider - Returns currently registered FeatureFlagsPort if available.
 */
export function getFeatureFlagsProvider(): FeatureFlagsPort | null {
  return globalFeatureFlagsPort;
}

/**
 * setFeatureFlagOverride - Manually sets a runtime override flag for testing or dynamic changes.
 */
export function setFeatureFlagOverride(flagName: string, value: boolean | string, description?: string): void {
  const g = globalThis as unknown as Record<string, Record<string, boolean | string>>;
  if (typeof globalThis !== "undefined") {
    if (!g.__mosaix_feature_flags) {
      g.__mosaix_feature_flags = {};
    }
    g.__mosaix_feature_flags[flagName] = value;
  }
  if (globalFeatureFlagsPort && typeof globalFeatureFlagsPort.setFlag === "function") {
    globalFeatureFlagsPort.setFlag(flagName, value, description);
  }
}

/**
 * featureAsync - Query platform/domain-specific feature flags asynchronously.
 * Hierarchy:
 * 1. Registered FeatureFlagsPort (hexagonal adapter e.g. Memory, LaunchDarkly, Database)
 * 2. globalThis.__mosaix_feature_flags (dynamic runtime overrides)
 * 3. Environment variables (e.g. PLATFORM_MCP_GATEWAY_ENABLED=true)
 * 4. defaultValue (fallback)
 */
export async function featureAsync(
  flagName: string,
  contextOrDefaultForward?: FeatureFlagUserContext | boolean,
  defaultValueFallback: boolean = false
): Promise<boolean> {
  const context = typeof contextOrDefaultForward === "object" ? contextOrDefaultForward : undefined;
  const defaultValue = typeof contextOrDefaultForward === "boolean" ? contextOrDefaultForward : defaultValueFallback;

  // 1. Registered Port adapter evaluation
  if (globalFeatureFlagsPort) {
    try {
      return await globalFeatureFlagsPort.isEnabled(flagName, context, defaultValue);
    } catch (e) {
      console.warn(`[FeatureFlags] Port evaluation failed for flag '${flagName}':`, e);
    }
  }

  // 2. Global in-memory overrides
  const g = globalThis as unknown as Record<string, Record<string, boolean | string>>;
  if (typeof globalThis !== "undefined" && g.__mosaix_feature_flags) {
    const flags = g.__mosaix_feature_flags;
    if (flagName in flags) {
      return !!flags[flagName];
    }
  }

  // 3. Fallback to environment variables (e.g. PLATFORM_MCP_GATEWAY_ENABLED=true)
  const envKey = flagName.toUpperCase().replace(/\./g, "_");
  if (typeof process !== "undefined" && process.env && process.env[envKey] !== undefined) {
    return process.env[envKey] === "true" || process.env[envKey] === "1";
  }

  // 4. Default value
  return defaultValue;
}

/**
 * featureVariationAsync - Query a multivariate or string feature flag variation.
 */
export async function featureVariationAsync(
  flagName: string,
  contextOrDefaultForward?: FeatureFlagUserContext | string,
  defaultValueFallback: string = ""
): Promise<string> {
  const context = typeof contextOrDefaultForward === "object" ? contextOrDefaultForward : undefined;
  const defaultValue = typeof contextOrDefaultForward === "string" ? contextOrDefaultForward : defaultValueFallback;

  if (globalFeatureFlagsPort) {
    try {
      return await globalFeatureFlagsPort.getVariation(flagName, context, defaultValue);
    } catch (e) {
      console.warn(`[FeatureFlags] Port variation evaluation failed for '${flagName}':`, e);
    }
  }

  const g = globalThis as unknown as Record<string, Record<string, boolean | string>>;
  if (typeof globalThis !== "undefined" && g.__mosaix_feature_flags) {
    const flags = g.__mosaix_feature_flags;
    if (flagName in flags) {
      return String(flags[flagName]);
    }
  }

  const envKey = flagName.toUpperCase().replace(/\./g, "_");
  if (typeof process !== "undefined" && process.env && process.env[envKey] !== undefined) {
    return String(process.env[envKey]);
  }

  return defaultValue;
}

export interface BoundedAppBootstrapOptions {
  manifest: ApplicationManifest;
  tenant: TenantIdentity;
  kernel: RuntimeKernel;
  provider: {
    register(container: Container): void | Promise<void>;
    boot(container: Container, router: Router): Promise<MosaixApp> | MosaixApp;
  };
}

/**
 * createBoundedAppBootstrap - Standard bootstrap factory for MosaiX Bounded Application Contexts.
 * Isolates IoC containers and routes, setting up standard registries.
 */
export async function createBoundedAppBootstrap(options: BoundedAppBootstrapOptions): Promise<{
  container: Container;
  router: Router;
  app: MosaixApp;
}> {
  // 1. Create a child container from the kernel's stable container
  const container = options.kernel.context.container.createChild();

  // Register Bounded Context specific instances
  container.instance("kernel", options.kernel);
  container.instance("tenant", options.tenant);
  container.instance("manifest", options.manifest);

  // 2. Instantiate and bind isolated Router
  const router = new Router();
  container.instance(Router, router);

  // 3. Invoke Service Provider registrations
  await options.provider.register(container);

  // 4. Boot and return the application
  const app = await options.provider.boot(container, router);
  container.instance(MosaixApp, app);

  return { container, router, app };
}
