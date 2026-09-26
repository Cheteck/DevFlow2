/**
 * @mosaix/database — Multi-tenant App Database Resolver
 */

import type {
  DatabasePort,
  DatabaseCapabilities,
  DatabaseConnection,
  MigrationLock,
} from "@mosaix/ports-database";

export class SchemaAwareDatabasePort implements DatabasePort {
  constructor(
    private readonly base: DatabasePort,
    private readonly schema: string,
  ) {}

  get capabilities(): DatabaseCapabilities {
    return this.base.capabilities;
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    await this.base.execute(`SET search_path TO ${this.schema}`);
    return this.base.execute(sql, params);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]> {
    await this.base.execute(`SET search_path TO ${this.schema}`);
    return this.base.query<T>(sql, params);
  }

  async transaction<T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    return this.base.transaction(async (tx) => {
      await tx.execute(`SET search_path TO ${this.schema}`);
      return fn(tx);
    });
  }

  async acquireMigrationLock(): Promise<MigrationLock> {
    return this.base.acquireMigrationLock();
  }
}

export class AppDatabaseResolver {
  private connections = new Map<string, DatabasePort>();

  register(key: string, db: DatabasePort): void {
    this.connections.set(key, db);
  }

  resolve(appId: string, tenantId?: string): DatabasePort {
    const key = tenantId ? `${appId}:${tenantId}` : appId;
    const conn = this.connections.get(key) ?? this.connections.get(appId);
    if (!conn) {
      throw new Error(`Database connection for [${key}] is not registered.`);
    }
    // Return wrapped connection with schema isolation
    return new SchemaAwareDatabasePort(conn, appId);
  }
}

export * from "./postgres-schema-grammar.js";
export * from "./postgres-rls-manager.js";
export * from "./postgres-bac-schema-migrator.js";
export * from "./database-manager.js";
