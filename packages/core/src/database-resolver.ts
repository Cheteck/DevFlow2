/**
 * @mosaix/core — Multi-Tenant Dynamic Database Resolver (PRD-App §10)
 */

import type { DatabasePort } from "@mosaix/ports-database";

export interface DatabaseResolverOptions {
  strategy: "per-app" | "per-tenant" | "shared";
}

export class AppDatabaseResolver {
  private connections = new Map<string, DatabasePort>();

  registerConnection(key: string, db: DatabasePort): void {
    this.connections.set(key, db);
  }

  resolve(appId: string, tenantId?: string): DatabasePort {
    const key = tenantId ? `${appId}:${tenantId}` : appId;
    const conn = this.connections.get(key) ?? this.connections.get(appId);
    if (!conn) {
      throw new Error(`Database connection for [${key}] is not registered.`);
    }
    return conn;
  }
}
