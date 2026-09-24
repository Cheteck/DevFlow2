import type { DatabasePort } from "@mosaix/ports-database";
import { PostgresSchemaGrammar } from "./postgres-schema-grammar.js";

export const CANONICAL_BAC_SCHEMAS = [
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
] as const;

export type CanonicalBacSchema = (typeof CANONICAL_BAC_SCHEMAS)[number];

export interface TableMigrationPlan {
  legacyPrefix: string;
  targetSchema: CanonicalBacSchema;
  tables: Array<{ legacyName: string; cleanName: string }>;
}

export class PostgresBacSchemaMigrator {
  private grammar = new PostgresSchemaGrammar();

  async provisionBacSchemas(db: DatabasePort, schemas: readonly string[] = CANONICAL_BAC_SCHEMAS): Promise<void> {
    for (const schema of schemas) {
      await db.execute(this.grammar.compileCreateSchema(schema));
    }
  }

  async migratePrefixedTablesToSchema(db: DatabasePort, plan: TableMigrationPlan): Promise<void> {
    // 1. Ensure target schema exists
    await db.execute(this.grammar.compileCreateSchema(plan.targetSchema));

    // 2. Move each table and rename to remove redundant prefix
    for (const table of plan.tables) {
      // Step A: ALTER TABLE "public"."citadelle_users" SET SCHEMA "citadelle";
      await db.execute(
        `ALTER TABLE IF EXISTS "public"."${table.legacyName}" SET SCHEMA "${plan.targetSchema}";`
      );
      // Step B: ALTER TABLE "citadelle"."citadelle_users" RENAME TO "users";
      if (table.legacyName !== table.cleanName) {
        await db.execute(
          `ALTER TABLE IF EXISTS "${plan.targetSchema}"."${table.legacyName}" RENAME TO "${table.cleanName}";`
        );
      }
    }
  }

  async grantSchemaPermissions(db: DatabasePort, schema: string, role: string): Promise<void> {
    await db.execute(this.grammar.compileGrantSchema(schema, role, ["USAGE", "CREATE"]));
  }

  getSearchPathForTenant(bac: string, tenantId?: string): string[] {
    const paths: string[] = [bac];
    if (tenantId) {
      paths.unshift(`tenant_${tenantId}`);
    }
    paths.push("public");
    return paths;
  }
}
