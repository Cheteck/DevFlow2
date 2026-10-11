import { describe, expect, it } from "vitest";
import type {
  DatabaseConnection,
  DatabasePort,
} from "@mosaix/ports-database";
import { stripCommercialFields } from "./strip-commercial-fields.js";

function createFakeDb(
  rows: Array<Record<string, unknown>>,
  opts?: { throwOnSelect?: boolean },
): DatabasePort & { executed: Array<{ sql: string; params: readonly unknown[] | undefined }> } {
  const executed: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
  const tx: DatabaseConnection = {
    execute: async (sql: string, params?: readonly unknown[]) => {
      executed.push({ sql, params });
      return 1;
    },
    query: async <T,>(sql: string): Promise<T[]> => {
      executed.push({ sql, params: undefined });
      return [] as unknown as T[];
    },
  };
  const db = {
    executed,
    capabilities: {
      dialect: "postgres" as const,
      transactions: true,
      lock: { distributed: false, processSafe: true, runtimeSafe: true },
    },
    execute: async (sql: string, params?: readonly unknown[]) => {
      executed.push({ sql, params });
      return 1;
    },
    query: async <T,>(): Promise<T[]> => {
      if (opts?.throwOnSelect) throw new Error('relation "portfolio_vendables" does not exist');
      return rows as unknown as T[];
    },
    transaction: async <T,>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> => fn(tx),
    acquireMigrationLock: async () => ({ release: async () => {} }),
  };
  return db;
}

const dirtyVariants = JSON.stringify([
  { id: "v1", reference: "V-RED", pricing: { basePrice: 35 }, inventory: { stock: 3 } },
  { id: "v2", reference: "V-BLUE" },
]);

describe("stripCommercialFields (PIM purity migration)", () => {
  it("dry-run reports without writing", async () => {
    const db = createFakeDb([{ id: "vend-1", variants: dirtyVariants }]);
    const report = await stripCommercialFields(db);

    expect(report.applied).toBe(false);
    expect(report.tableFound).toBe(true);
    expect(report.vendablesScanned).toBe(1);
    expect(report.variantsScanned).toBe(2);
    expect(report.variantsStripped).toBe(1);
    expect(report.archived).toHaveLength(1);
    expect(report.archived[0]?.vendableId).toBe("vend-1");
    expect(report.archived[0]?.variantId).toBe("v1");
    expect(db.executed).toHaveLength(0);
  });

  it("apply archives payloads and strips variants atomically", async () => {
    const db = createFakeDb([{ id: "vend-1", variants: dirtyVariants }]);
    const report = await stripCommercialFields(db, { apply: true });

    expect(report.applied).toBe(true);
    const statements = db.executed.map((e) => e.sql);
    // Postgres dialect: schema-qualified names (v1.003 isolation, no prefix).
    expect(statements[0]).toContain('CREATE TABLE IF NOT EXISTS "portfolio"."commercial_archive"');
    expect(statements.some((s) => s.startsWith('INSERT INTO "portfolio"."commercial_archive"'))).toBe(true);
    const update = db.executed.find((e) => e.sql.startsWith('UPDATE "portfolio"."vendables"'));
    expect(update).toBeDefined();
    const cleaned = JSON.parse(update?.params?.[0] as string) as Array<Record<string, unknown>>;
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]).not.toHaveProperty("pricing");
    expect(cleaned[0]).not.toHaveProperty("inventory");
    expect(cleaned[1]).toEqual({ id: "v2", reference: "V-BLUE" });
  });

  it("clean rows produce no writes", async () => {
    const db = createFakeDb([{ id: "vend-1", variants: JSON.stringify([{ id: "v1" }]) }]);
    const report = await stripCommercialFields(db, { apply: true });

    expect(report.applied).toBe(false);
    expect(report.variantsStripped).toBe(0);
    expect(db.executed).toHaveLength(0);
  });

  it("missing table reports zero-scan without error", async () => {
    const db = createFakeDb([], { throwOnSelect: true });
    const report = await stripCommercialFields(db, { apply: true });

    expect(report.tableFound).toBe(false);
    expect(report.applied).toBe(false);
    expect(db.executed).toHaveLength(0);
  });
});
