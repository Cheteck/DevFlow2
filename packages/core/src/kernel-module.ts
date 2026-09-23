/**
 * @mosaix/core — Kernel Module System
 *
 * The kernel is intentionally small: it installs `KernelModule`s, starts and
 * stops them, and exposes a stable `KernelContext` — the only contract modules
 * and applications depend on. Future capabilities are added as new modules,
 * never by modifying the kernel (ADR-0002).
 */

import { Container } from "@mosaix/container";
import type { LogLevel, Logger, Metrics, Trace } from "./observability";
import { ApplicationRegistry, type AppRegistry } from "./app-registry";
import type { DomainEventBus, EventStore } from "./event-bus";
import type { EventSchemaRegistry } from "./event-schema-registry";
import type { PermissionRegistry, AuthorizationEngine } from "./permission";
import type { CapabilityRegistry } from "./capability-registry";
import type { PermissionString, TenantIdentity } from "@mosaix/types";
import { RegistrationError, ServiceNotInstalledError } from "./kernel-errors";

export interface PermissionGrant {
  app: string;
  permission: PermissionString;
  tenant: TenantIdentity;
}

export interface KernelConfig {
  platformId?: string;
  environment?: string;
  runtimeId?: string;
  logLevel?: LogLevel;
  grants?: PermissionGrant[];
  onAppStateChanged?: (appId: string, status: string) => void;
}

export interface KernelServices {
  events: DomainEventBus;
  eventStore: EventStore;
  eventSchemas: EventSchemaRegistry;
  permissions: PermissionRegistry;
  authorization: AuthorizationEngine;
  capabilities: CapabilityRegistry;
}

export type KernelServiceName = keyof KernelServices;

export const KERNEL_SERVICE_NAMES: readonly KernelServiceName[] = [
  "events",
  "eventStore",
  "eventSchemas",
  "permissions",
  "authorization",
  "capabilities",
] as const;

/**
 * KernelContext — the stable contract that modules and applications depend on.
 *
 * Directlly constructable for testing modules in isolation. Canonical services
 * (KERNEL_SERVICE_NAMES) throw ServiceNotInstalledError when missing;
 * extension services return undefined.
 */
export class KernelContext implements KernelServices {
  private readonly services = new Map<string, unknown>();
  readonly config: KernelConfig;
  readonly platformId: string;
  readonly environment: string;
  readonly runtimeId: string;
  readonly container: Container;
  readonly apps: AppRegistry;

  constructor(config: KernelConfig = {}) {
    this.config = config;
    this.platformId = config.platformId ?? "mosaix-platform";
    this.environment = config.environment ?? "development";
    this.runtimeId = config.runtimeId ?? `rt-${Date.now()}`;
    this.container = new Container();
    this.apps = new ApplicationRegistry();
  }

  get permissions(): PermissionRegistry {
    return this.getService("permissions") as PermissionRegistry;
  }

  get authorization(): AuthorizationEngine {
    return this.getService("authorization") as AuthorizationEngine;
  }

  get capabilities(): CapabilityRegistry {
    return this.getService("capabilities") as CapabilityRegistry;
  }

  get eventSchemas(): EventSchemaRegistry {
    return this.getService("eventSchemas") as EventSchemaRegistry;
  }

  get events(): DomainEventBus {
    return this.getService("events") as DomainEventBus;
  }

  get eventStore(): EventStore {
    return this.getService("eventStore") as EventStore;
  }

  get logger(): Logger {
    return this.getService("logger") as Logger;
  }

  get metrics(): Metrics {
    return this.getService("metrics") as Metrics;
  }

  get tracer(): Trace {
    return this.getService("tracer") as Trace;
  }

  setService<K extends KernelServiceName>(
    name: K,
    service: KernelServices[K],
  ): void;
  setService<K extends string>(
    name: Exclude<K, KernelServiceName>,
    service: unknown,
  ): void;
  setService(name: string, service: unknown): void {
    if (this.services.has(name)) {
      throw new RegistrationError(
        `Service [${name}] is already registered in KernelContext.`,
        { duplicateOf: name },
      );
    }
    this.services.set(name, service);
    this.container.instance(name, service);
  }

  getService<K extends KernelServiceName>(name: K): KernelServices[K];
  getService<T>(name: string): T | undefined;
  getService(name: string): unknown {
    const service = this.services.get(name);
    if (service !== undefined) {
      return service;
    }

    if ((KERNEL_SERVICE_NAMES as readonly string[]).includes(name)) {
      const missing = KERNEL_SERVICE_NAMES.filter(
        (n) => !this.services.has(n),
      );
      if (missing.length === KERNEL_SERVICE_NAMES.length) {
        throw new ServiceNotInstalledError(name, {
          message: `installation incomplete — missing canonical services: ${missing.join(", ")}`,
          missingServices: [...missing],
        });
      }
      throw new ServiceNotInstalledError(name);
    }

    return undefined;
  }

  hasService(name: string): boolean {
    return this.services.has(name);
  }
}

export interface KernelOptions {
  modules?: KernelModule[];
  config?: Partial<KernelConfig>;
  observability?: {
    logger?: Logger;
    metrics?: Metrics;
    tracer?: Trace;
  };
}

export interface KernelModule {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: readonly string[];
  register(ctx: KernelContext): void;
  boot?(ctx: KernelContext): void | Promise<void>;
  start?(ctx: KernelContext): void | Promise<void>;
  stop?(ctx: KernelContext): void | Promise<void>;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}
