import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, createApp } from "./index.js";
import { databaseReady, closeDatabase } from "../src/shell/database-bootstrap.js";
import { runShellMigrations } from "../src/shell/migrations.js";

describe("Bootstrap Application", () => {
  beforeEach(async () => {
    // Set in-memory sqlite DB for test isolation
    process.env.MOSAIX_DATABASE_URL = "sqlite::memory:";
    const { dbAdapter } = await databaseReady();
    await runShellMigrations(dbAdapter);
  });

  afterEach(async () => {
    await closeDatabase();
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
    expect(services.feedService).toBeDefined();
    expect(services.eventBackplane).toBeDefined();
    expect(services.anonymizationOrchestrator).toBeDefined();
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
});
