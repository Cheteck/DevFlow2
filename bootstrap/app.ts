/**
 * @mosaix/bootstrap — Core Framework Application Bootstrapper
 * Inspired by Laravel bootstrap/app.php.
 */

import * as http from "node:http";
import type { ServiceProvider } from "./providers.js";
import { providers as defaultProviders } from "./providers.js";

export interface ApplicationOptions {
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

  public setService<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  public getService<T>(name: string): T {
    if (!this.services.has(name)) {
      throw new Error(`[MosaixApplication] Service [${name}] is not registered.`);
    }
    return this.services.get(name) as T;
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
    const envConfig = this.config.get("env") as { resolvedPort?: number } | undefined;
    const targetPort = port ?? envConfig?.resolvedPort ?? 3000;

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
      const manager = this.getService<{ close: () => Promise<void> }>("databaseManager");
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
  const app = new MosaixApplication();
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
