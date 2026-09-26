import { describe, it, expect, afterEach } from "vitest";
import {
  ApplicationBuilder,
  applicationProviders,
  closeDatabase,
  createApplication,
  createCliApplication,
} from "./index.js";

function memoryOptions() {
  return {
    rootDir: process.cwd(),
    env: {
      DB_CONNECTION: "sqlite",
      DB_DATABASE: ":memory:",
      MOSAIX_ENV: "development",
    } as Record<string, string | undefined>,
    envFiles: [] as string[],
    skipSecurity: true,
    skipComposition: true,
    skipTheme: true,
  };
}

afterEach(async () => {
  await closeDatabase();
});

describe("bootstrap/app (Laravel-style composition root)", () => {
  it("exposes an explicit provider registry in boot order", () => {
    const names = applicationProviders.map((p) => p.name);
    expect(names).toContain("database");
    expect(names.indexOf("env")).toBeLessThan(names.indexOf("database"));
    expect(names.indexOf("database")).toBeLessThan(
      names.indexOf("migrations-check"),
    );
  });

  it("createCliApplication connects on :memory: without migrating", async () => {
    const app = await createCliApplication(memoryOptions());
    expect(app.config.connection).toBe("sqlite");
    expect(app.env.resolvedDbConnection).toBe("sqlite");
    expect(app.dbAdapter).toBeDefined();
    expect(app.identityStore).toBeDefined();
    // Connect hook awaited: PRAGMAs applied, writable.
    await expect(
      app.dbAdapter.execute(
        "CREATE TABLE bootstrap_smoke (id INTEGER PRIMARY KEY)",
      ),
    ).resolves.toBeDefined();
    // Application-owned shutdown is idempotent.
    await expect(app.close()).resolves.toBeUndefined();
    await expect(app.close()).resolves.toBeUndefined();
  });

  it("createApplication fails fast when migrations are pending", async () => {
    await expect(createApplication(memoryOptions())).rejects.toThrow(
      /database not migrated/,
    );
  });

  it("builder runs steps in canonical order regardless of call order", async () => {
    const app = await new ApplicationBuilder({
      ...memoryOptions(),
      skipMigrationsCheck: true,
    })
      .withTheme()
      .withDatabase()
      .withEnv()
      .build();
    expect(app.dbAdapter).toBeDefined();
    expect(app.compositionOverrideManager).toBeDefined();
  });
});
