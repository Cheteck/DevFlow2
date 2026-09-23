/**
 * @mosaix/core — Database Module
 *
 * Manages per-application database connection/adapter instances and
 * registers them into KernelContext as the "database" service.
 * In-memory adapters are used strictly as a fallback when no valid
 * database configuration is registered.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { KernelContext, KernelModule } from "../kernel-module";
import { AppDatabaseResolver } from "../database-resolver";

export interface DatabaseModuleOptions {
  /** Map of application ID to its corresponding database adapter instance */
  adapters?: Record<string, unknown>;
  /** Default database adapter instance when an app-specific one is not defined */
  defaultAdapter?: unknown;
}

export interface DatabaseService {
  getAdapter(appId: string): unknown;
  setAdapter(appId: string, adapter: unknown): void;
  hasValidAdapter(appId: string): boolean;
  resolveAdapter(appId: string, tenantId?: string, fallbackAdapter?: unknown): unknown;
  listAppsWithDatabase(): string[];
  resolver: AppDatabaseResolver;
}

export class DatabaseModule implements KernelModule {
  readonly name = "database";
  readonly version = "1.0.0";

  private readonly adapters = new Map<string, unknown>();
  private readonly defaultAdapter?: unknown;
  private readonly resolver = new AppDatabaseResolver();

  constructor(options: DatabaseModuleOptions = {}) {
    if (options.adapters) {
      for (const [appId, adapter] of Object.entries(options.adapters)) {
        if (adapter !== undefined) {
          this.adapters.set(appId, adapter);
          if (typeof adapter === "object" && adapter !== null && "query" in adapter) {
            this.resolver.registerConnection(appId, adapter as unknown as DatabasePort);
          }
        }
      }
    }
    this.defaultAdapter = options.defaultAdapter;
  }

  register(ctx: KernelContext): void {
    const service: DatabaseService = {
      getAdapter: (appId: string): unknown => {
        return this.adapters.get(appId) ?? this.defaultAdapter;
      },
      setAdapter: (appId: string, adapter: unknown): void => {
        this.adapters.set(appId, adapter);
        if (typeof adapter === "object" && adapter !== null && "query" in adapter) {
          this.resolver.registerConnection(appId, adapter as unknown as DatabasePort);
        }
      },
      hasValidAdapter: (appId: string): boolean => {
        return this.adapters.has(appId) || this.defaultAdapter !== undefined;
      },
      resolveAdapter: (appId: string, tenantId?: string, fallbackAdapter?: unknown): unknown => {
        try {
          return this.resolver.resolve(appId, tenantId);
        } catch {
          return this.adapters.get(appId) ?? this.defaultAdapter ?? fallbackAdapter;
        }
      },
      listAppsWithDatabase: (): string[] => {
        return Array.from(this.adapters.keys());
      },
      resolver: this.resolver,
    };

    ctx.setService("database", service);
  }
}
