/**
 * @mosaix/bootstrap — Core Application Container
 * Centralizes application lifecycle (configuration, service registration, HTTP runtime server).
 */

import * as http from "node:http";
import { loadConfiguration, type ApplicationConfig } from "./configuration.js";
import { registerServices, type ApplicationServices } from "./services.js";
import { createHttpRequestHandler } from "./runtime.js";

export class Application {
  private config!: ApplicationConfig;
  private services!: ApplicationServices;
  private httpServer?: http.Server;
  private booted = false;

  /**
   * Bootstraps the application: loads configuration and registers core services.
   */
  async boot(): Promise<this> {
    if (this.booted) return this;

    // Phase 1: Configuration loading
    this.config = loadConfiguration();

    // Phase 2: Service registration & verification
    this.services = await registerServices();

    this.booted = true;
    return this;
  }

  /**
   * Creates the Node.js HTTP server.
   */
  createServer(): http.Server {
    if (!this.booted) {
      throw new Error("Application must be booted before creating HTTP server. Call app.boot() first.");
    }
    const requestHandler = createHttpRequestHandler(this.services);
    this.httpServer = http.createServer(requestHandler);
    return this.httpServer;
  }

  /**
   * Starts the HTTP server on the configured port.
   */
  async listen(port?: number, host = "0.0.0.0"): Promise<http.Server> {
    if (!this.booted) {
      await this.boot();
    }
    const serverPort = port ?? this.config.port;
    const server = this.httpServer || this.createServer();

    return new Promise((resolve) => {
      server.listen(serverPort, host, () => {
        console.log(`MosaiX platform host listening on http://${host}:${serverPort}`);
        resolve(server);
      });
    });
  }

  getConfig(): ApplicationConfig {
    return this.config;
  }

  getServices(): ApplicationServices {
    return this.services;
  }
}

/**
 * Creates a new Application instance (Laravel-style helper).
 */
export function createApp(): Application {
  return new Application();
}
