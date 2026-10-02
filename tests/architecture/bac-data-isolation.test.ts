import { describe, it, expect } from "vitest";
import {
  PostgresBacSchemaMigrator,
  CANONICAL_BAC_SCHEMAS,
} from "../../packages/database/src/postgres-bac-schema-migrator.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("BAC Data Isolation & Schema Architectural Specification Suite", () => {
  it("should define 10 canonical BAC schemas in PostgresBacSchemaMigrator", () => {
    expect(CANONICAL_BAC_SCHEMAS).toHaveLength(10);
    expect(CANONICAL_BAC_SCHEMAS).toEqual([
      "citadelle",
      "commerce",
      "portfolio",
      "solara",
      "booking",
      "solidarity",
      "beam",
      "spaces",
      "imperia",
      "subscription",
    ]);
  });

  it("should provision all 10 BAC schemas without errors on PostgreSQL database port", async () => {
    const executedSql: string[] = [];
    const mockDb = {
      execute: async (sql: string) => {
        executedSql.push(sql);
        return [];
      },
    } as unknown as import("@mosaix/ports-database").DatabasePort;

    const migrator = new PostgresBacSchemaMigrator();
    await migrator.provisionBacSchemas(mockDb);

    expect(executedSql).toHaveLength(10);
    for (const schema of CANONICAL_BAC_SCHEMAS) {
      expect(executedSql.some((sql) => sql.includes(`CREATE SCHEMA IF NOT EXISTS "${schema}"`))).toBe(true);
    }
  });

  it("should verify that no cross-BAC SQL foreign key references exist across application migrations", () => {
    const appsDir = path.resolve(process.cwd(), "apps");
    const appFolders = fs.readdirSync(appsDir);

    const crossBacFkViolations: string[] = [];

    for (const appFolder of appFolders) {
      if (appFolder.startsWith("_") || !fs.statSync(path.join(appsDir, appFolder)).isDirectory()) {
        continue;
      }

      const migrationsDir = path.join(appsDir, appFolder, "src", "infrastructure");
      if (!fs.existsSync(migrationsDir)) continue;

      const scanFiles = (dir: string): string[] => {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            results = results.concat(scanFiles(fullPath));
          } else if (file.endsWith(".ts")) {
            results.push(fullPath);
          }
        }
        return results;
      };

      const files = scanFiles(migrationsDir);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf8");

        const fkMatches = content.matchAll(/foreignKey\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g);
        for (const match of fkMatches) {
          const targetTable = match[2];
          if (
            (appFolder === "commerce" && targetTable.startsWith("solara_")) ||
            (appFolder === "solara" && targetTable.startsWith("commerce_")) ||
            (appFolder === "booking" && targetTable.startsWith("identities"))
          ) {
            crossBacFkViolations.push(`${file}: FK to ${targetTable}`);
          }
        }
      }
    }

    expect(crossBacFkViolations).toEqual([]);
  });

  it("should ensure searchPath calculation isolates BAC schemas with tenant fallback", () => {
    const migrator = new PostgresBacSchemaMigrator();

    const tenantPath = migrator.getSearchPathForTenant("commerce", "tenant_acme");
    expect(tenantPath).toEqual(["tenant_tenant_acme", "commerce", "public"]);

    const defaultPath = migrator.getSearchPathForTenant("solara");
    expect(defaultPath).toEqual(["solara", "public"]);
  });
});
