import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MosaixApplication,
  createApplication,
  bootstrapApplication,
  type ServiceProvider,
} from "./index.js";
import { closeDatabase, initDatabase } from "../src/shell/database-bootstrap.js";
import { runShellMigrations } from "../src/shell/migrations.js";

describe("MosaiX Bootstrap Suite (Laravel-inspired)", () => {
  afterEach(async () => {
    await closeDatabase();
  });

  it("registers and boots service providers in proper sequential order", async () => {
    const executionOrder: string[] = [];

    const testProviderA: ServiceProvider = {
      name: "TestProviderA",
      register(app) {
        executionOrder.push("A:register");
        app.setConfig("providerA", true);
      },
      boot(app) {
        executionOrder.push("A:boot");
        app.setService("env", { resolvedPort: 3000 } as any);
      },
    };

    const testProviderB: ServiceProvider = {
      name: "TestProviderB",
      register() {
        executionOrder.push("B:register");
      },
      boot() {
        executionOrder.push("B:boot");
      },
    };

    const app = new MosaixApplication();
    app.register(testProviderA).register(testProviderB);

    expect(app.isBooted()).toBe(false);
    await app.boot();
    expect(app.isBooted()).toBe(true);

    // Verify two-phase execution: all registers first, then all boots
    expect(executionOrder).toEqual([
      "A:register",
      "B:register",
      "A:boot",
      "B:boot",
    ]);

    expect(app.getConfig("providerA")).toBe(true);
    expect(app.env.resolvedPort).toBe(3000);
  });

  it("handles config and service lookup with error fallbacks", () => {
    const app = new MosaixApplication();
    app.setConfig("app.name", "MosaiX");

    expect(app.getConfig("app.name")).toBe("MosaiX");
    expect(app.getConfig("non.existent", "default-val")).toBe("default-val");
    expect(() => app.getConfig("non.existent")).toThrowError(
      "[MosaixApplication] Config key [non.existent] is not set.",
    );

    expect(app.hasService("env")).toBe(false);
    expect(() => app.getService("env")).toThrowError(
      "[MosaixApplication] Service [env] is not registered.",
    );

    app.setService("env", { resolvedPort: 4000 } as any);
    expect(app.hasService("env")).toBe(true);
    expect(app.env.resolvedPort).toBe(4000);
  });

  it("creates and boots application via createApplication/bootstrapApplication factory", async () => {
    const providerCalled = vi.fn();
    const mockProvider: ServiceProvider = {
      name: "MockProvider",
      boot() {
        providerCalled();
      },
    };

    const app = await createApplication({
      providers: [mockProvider],
    });

    expect(app.isBooted()).toBe(true);
    expect(providerCalled).toHaveBeenCalledTimes(1);

    expect(bootstrapApplication).toBe(createApplication);
  });

  it("allows setting up HTTP server on application instance", async () => {
    const app = new MosaixApplication();
    const server = app.createServer((_req, res) => {
      res.writeHead(200);
      res.end("OK");
    });

    expect(server).toBeDefined();
    expect(app.server).toBe(server);
  });

  // Requirement 2: Real Database integration tests with injected env
  it("fails fast with 'database not migrated' on fresh unmigrated SQLite :memory: database", async () => {
    const testEnv = {
      DB_CONNECTION: "sqlite",
      DB_DATABASE: ":memory:",
      MOSAIX_APP_KEY: "base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
    };

    await expect(createApplication({ env: testEnv })).rejects.toThrowError(
      /database not migrated/,
    );
  });

  it("boots successfully with applied migrations and verifies SQLite write query", async () => {
    const testEnv = {
      DB_CONNECTION: "sqlite",
      DB_DATABASE: ":memory:",
      MOSAIX_APP_KEY: "base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
    };

    // Pre-migrate the memory database instance
    const { dbAdapter } = initDatabase({ env: testEnv });
    await runShellMigrations(dbAdapter);

    // Boot application with injected env
    const app = await createApplication({ env: testEnv });
    expect(app.isBooted()).toBe(true);

    // Verify DB write query through app.db accessor
    await app.db.execute("CREATE TABLE test_bootstrap (id TEXT PRIMARY KEY, val TEXT)");
    await app.db.execute("INSERT INTO test_bootstrap VALUES (?, ?)", ["1", "verified"]);

    const rows = await app.db.query<{ val: string }>(
      "SELECT val FROM test_bootstrap WHERE id = ?",
      ["1"],
    );
    expect(rows[0]?.val).toBe("verified");

    await app.close();
  });
});
