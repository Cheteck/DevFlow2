/**
 * @mosaix/core — Multi-Tenant Dynamic Database Schema Isolation Manager (Phase 19)
 */

import type { DatabasePort } from "@mosaix/ports-database";

export class MultiTenantSchemaManager {
  private activeSchemas = new Set<string>();

  async ensureTenantSchema(db: DatabasePort, tenantId: string, dialect: "sqlite" | "postgres" = "postgres"): Promise<string> {
    const schemaName = `tenant_${tenantId.replace(/[^a-zA-Z0-9_]/g, "_")}`;

    if (this.activeSchemas.has(schemaName)) {
      return schemaName;
    }

    if (dialect === "postgres") {
      await db.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      await db.query(`SET search_path TO "${schemaName}", public`);
    } else {
      // SQLite per-tenant database isolation table scoping
      await db.query(`CREATE TABLE IF NOT EXISTS "${schemaName}_metadata" (id TEXT PRIMARY KEY, created_at TEXT)`);
    }

    this.activeSchemas.add(schemaName);
    return schemaName;
  }

  getActiveSchemas(): string[] {
    return Array.from(this.activeSchemas);
  }

  clear(): void {
    this.activeSchemas.clear();
  }
}

export const multiTenantSchemaManager = new MultiTenantSchemaManager();
