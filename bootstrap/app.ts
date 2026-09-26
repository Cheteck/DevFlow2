/**
 * @mosaix/bootstrap — Core Framework Application Bootstrapper
 * Inspired by Laravel bootstrap/app.php.
 */

import * as http from "node:http";
import type { DatabasePort } from "@mosaix/ports-database";
import type { IdentityStore } from "@mosaix/ports-identity-store";
import type { DatabaseManager } from "@mosaix/database";
import type { CompositionOverrideManager, validateEnv } from "@mosaix/core";
import type { ServiceProvider } from "./providers.js";
import { providers as defaultProviders } from "./providers.js";

export type EnvConfig = ReturnType<typeof validateEnv>;

export interface ApplicationServices {
  env: EnvConfig;
  dbAdapter: DatabasePort;
  identityStore: IdentityStore;
  databaseManager: DatabaseManager;
  compositionOverrideManager: CompositionOverrideManager;
}

export interface ApplicationOptions {
  env?: Record<string, string | undefined>;
  rootDir?: string;
  providers?: ServiceProvider[];
  handler?: http.RequestListener;
  autoListen?: boolean;
  port?: number;
  host?: string;
}

export class MosaixApplication {
  private readonly services = new Map<string, unknown>();
  private readonly config = new Map<string, unknown>();
  private readonly registeredProviders: ServiceProvider[] = [];
  private booted = false;
  public server: http.Server | null = null;
  public readonly options: ApplicationOptions;

  constructor(options: ApplicationOptions = {}) {
    this.options = options;
  }

  public register(provider: ServiceProvider): this {
    this.registeredProviders.push(provider);
    return this;
  }

  public registerProviders(providersList: ServiceProvider[]): this {
    for (const provider of providersList) {
      this.register(provider);
    }
    return this;
  }

  public setService<K extends keyof ApplicationServices>(
    name: K,
    service: ApplicationServices[K],
  ): void;
  public setService<T>(name: string, service: T): void;
  public setService(name: string, service: unknown): void {
    this.services.set(name, service);
  }

  public getService<K extends keyof ApplicationServices>(
    name: K,
  ): ApplicationServices[K];
  public getService<T>(name: string): T;
  public getService(name: string): unknown {
    if (!this.services.has(name)) {
      throw new Error(
        `[MosaixApplication] Service [${String(name)}] is not registered.`,
      );
    }
    return this.services.get(name);
  }

  public hasService(name: string): boolean {
    return this.services.has(name);
  }

  public setConfig<T>(key: string, value: T): void {
    this.config.set(key, value);
  }

  public getConfig<T>(key: string, defaultValue?: T): T {
    if (this.config.has(key)) {
      return this.config.get(key) as T;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`[MosaixApplication] Config key [${key}] is not set.`);
  }

  public hasConfig(key: string): boolean {
    return this.config.has(key);
  }

  // Strongly typed accessors for core services
  public get env(): EnvConfig {
    return this.getService("env");
  }

  public get db(): DatabasePort {
    return this.getService("dbAdapter");
  }

  public get identity(): IdentityStore {
    return this.getService("identityStore");
  }

  public get databaseManager(): DatabaseManager {
    return this.getService("databaseManager");
  }

  public get composition(): CompositionOverrideManager {
    return this.getService("compositionOverrideManager");
  }

  public isBooted(): boolean {
    return this.booted;
  }

  public async boot(): Promise<this> {
    if (this.booted) {
      return this;
    }

    // Phase 1: Register all providers
    for (const provider of this.registeredProviders) {
      if (typeof provider.register === "function") {
        await provider.register(this);
      }
    }

    // Phase 2: Boot all providers
    for (const provider of this.registeredProviders) {
      if (typeof provider.boot === "function") {
        await provider.boot(this);
      }
    }

    this.booted = true;
    return this;
  }

  public createServer(handler: http.RequestListener): http.Server {
    this.server = http.createServer(handler);
    return this.server;
  }

  public async listen(
    port?: number,
    host = "0.0.0.0",
    callback?: () => void,
  ): Promise<http.Server> {
    if (!this.server) {
      throw new Error("[MosaixApplication] Server has not been created.");
    }
    let targetPort = port;
    if (targetPort === undefined && this.hasService("env")) {
      targetPort = this.env.resolvedPort;
    }
    if (targetPort === undefined) {
      targetPort = 3000;
    }

    return new Promise((resolve) => {
      this.server!.listen(targetPort, host, () => {
        if (callback) callback();
        resolve(this.server!);
      });
    });
  }

  public async close(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => (err ? reject(err) : resolve()));
      });
      this.server = null;
    }
    if (this.hasService("databaseManager")) {
      const manager = this.databaseManager;
      await manager.close();
    }
  }
}

/**
 * Creates and boots a new MosaiX Application instance.
 * Inspired by Laravel's bootstrap/app.php factory pattern.
 */
export async function createApplication(
  options: ApplicationOptions = {},
): Promise<MosaixApplication> {
  const app = new MosaixApplication(options);
  const activeProviders = options.providers ?? defaultProviders;

  app.registerProviders(activeProviders);
  await app.boot();

  if (options.handler) {
    app.createServer(options.handler);
    if (options.autoListen) {
      await app.listen(options.port, options.host);
    }
  }

  return app;
}

/**
 * Alias for createApplication — Laravel-style `bootstrapApplication`.
 */
export const bootstrapApplication = createApplication;
