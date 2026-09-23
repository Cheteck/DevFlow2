import { describe, expect, it } from "vitest";
import { AppDatabaseResolver } from "./database-resolver";

describe("Framework Dogfooding & Wiring Verification", () => {
  it("resolves per-app database connections dynamically", () => {
    const resolver = new AppDatabaseResolver();
    const mockDb: { query: (sql: string) => Promise<unknown[]> } = { query: async () => [] };
    resolver.registerConnection("identity", mockDb);

    expect(resolver.resolve("identity")).toBe(mockDb);
  });
});
