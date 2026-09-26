import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, createApp } from "./index.js";
import { databaseReady, closeDatabase } from "../src/shell/database-bootstrap.js";
import { runShellMigrations } from "../src/shell/migrations.js";

describe("Bootstrap Application", () => {
  let originalDbUrl: string | undefined;

  beforeEach(async () => {
    originalDbUrl = process.env.MOSAIX_DATABASE_URL;
    process.env.MOSAIX_DATABASE_URL = "sqlite::memory:";
    const { dbAdapter } = await databaseReady();
    await runShellMigrations(dbAdapter);
  });

  afterEach(async () => {
    await closeDatabase();
    if (originalDbUrl !== undefined) {
      process.env.MOSAIX_DATABASE_URL = originalDbUrl;
    } else {
      delete process.env.MOSAIX_DATABASE_URL;
    }
  });

  it("creates an Application instance", () => {
    const app = createApp();
    expect(app).toBeInstanceOf(Application);
  });

  it("boots configuration and services", async () => {
    const app = createApp();
    await app.boot();

    const config = app.getConfig();
    expect(config).toBeDefined();
    expect(config.port).toBeTypeOf("number");

    const services = app.getServices();
    expect(services).toBeDefined();
    expect(services.compositionOverrideManager).toBeDefined();
    expect(typeof services.getFeedService).toBe("function");
    expect(services.eventBackplane).toBeDefined();
    expect(typeof services.getAnonymizationOrchestrator).toBe("function");
  });

  it("creates an HTTP server when booted", async () => {
    const app = createApp();
    await app.boot();

    const server = app.createServer();
    expect(server).toBeDefined();
  });

  it("throws error if createServer is called before boot", () => {
    const app = createApp();
    expect(() => app.createServer()).toThrow("Application must be booted before creating HTTP server");
  });

  it("throws error if listen is called before boot", async () => {
    const app = createApp();
    await expect(app.listen()).rejects.toThrow("Application must be booted before listening");
  });
});
