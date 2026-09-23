import type {
  DatabaseCapabilities,
  DatabaseConnection,
  DatabasePort,
  MigrationLock,
} from "@mosaix/ports-database";

export interface PgQueryResult {
  readonly rows: readonly unknown[];
  readonly rowCount?: number | null;
}

export interface PgClient {
  query(sql: string, params?: readonly unknown[]): Promise<PgQueryResult>;
  connect?(): Promise<void>;
  release?(): Promise<void> | void;
  end?(): Promise<void>;
}

export interface PostgresPoolOptions {
  readonly connectionString?: string;
  readonly maxConnections?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
  readonly healthCheckIntervalMillis?: number;
}

/**
 * Resilient Connection Pool Manager for PostgreSQL.
 * Manages client acquisition, health checks, transient error retries, and graceful termination.
 */
export class PostgresPoolManager {
  private readonly clients: Set<PgClient> = new Set();
  private isClosed = false;

  constructor(
    private readonly clientFactory: () => PgClient,
    private readonly options: PostgresPoolOptions = {}
  ) {}

  async acquireClient(): Promise<PgClient> {
    if (this.isClosed) {
      throw new Error("PostgresPoolManager has been closed.");
    }

    const client = this.clientFactory();
    if (client.connect) {
      await client.connect();
    }
    this.clients.add(client);
    return client;
  }

  async executeWithRetry<T>(
    operation: (client: PgClient) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let client: PgClient | null = null;
      try {
        client = await this.acquireClient();
        const result = await operation(client);
        return result;
      } catch (err) {
        lastError = err;
        const errMessage = String(err).toLowerCase();
        // Retry on transient connection issues
        if (
          attempt < maxRetries &&
          (errMessage.includes("connection") ||
            errMessage.includes("econnrefused") ||
            errMessage.includes("closed"))
        ) {
          await new Promise((r) => setTimeout(r, attempt * 100));
          continue;
        }
        throw err;
      } finally {
        if (client) {
          if (client.release) {
            await client.release();
          }
          this.clients.delete(client);
        }
      }
    }
    throw lastError;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.executeWithRetry(async (client) => {
        return client.query("SELECT 1 as healthy");
      });
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    this.isClosed = true;
    for (const client of this.clients) {
      try {
        if (client.end) {
          await client.end();
        } else if (client.release) {
          await client.release();
        }
      } catch {
        // Ignore closing errors on shutdown
      }
    }
    this.clients.clear();
  }
}

/**
 * PostgreSQL `DatabasePort` adapter. Duck-typed constructor accepting any pg-compatible client/pool or PostgresPoolManager.
 */
export class PostgresDatabaseAdapter implements DatabasePort {
  readonly capabilities: DatabaseCapabilities = {
    dialect: "postgres",
    transactions: true,
    lock: { distributed: true, processSafe: true, runtimeSafe: true },
  };

  private readonly client: PgClient;
  private readonly poolManager?: PostgresPoolManager;
  private savepointDepth = 0;

  constructor(clientOrPool: PgClient | PostgresPoolManager) {
    if (clientOrPool instanceof PostgresPoolManager) {
      this.poolManager = clientOrPool;
      this.client = {
        query: (sql, params) =>
          clientOrPool.executeWithRetry((c) => c.query(sql, params)),
      };
    } else {
      this.client = clientOrPool;
    }
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    const res = await this.client.query(sql, params);
    return res.rowCount ?? 0;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<T[]> {
    const res = await this.client.query(sql, params);
    return res.rows as unknown as T[];
  }

  async transaction<T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    const depth = this.savepointDepth;
    const savepoint = `mosaix_tx_${depth}`;
    this.savepointDepth++;
    try {
      if (depth > 0) {
        await this.client.query(`SAVEPOINT ${savepoint}`);
      } else {
        await this.client.query("BEGIN");
      }
      const tx: DatabaseConnection = {
        execute: (sql: string, params?: readonly unknown[]) =>
          this.execute(sql, params),
        query: (sql: string, params?: readonly unknown[]) =>
          this.query(sql, params),
      };
      const result = await fn(tx);
      if (depth > 0) {
        await this.client.query(`RELEASE ${savepoint}`);
      } else {
        await this.client.query("COMMIT");
      }
      return result;
    } catch (err) {
      if (depth > 0) {
        await this.client.query(`ROLLBACK TO ${savepoint}`);
        await this.client.query(`RELEASE ${savepoint}`);
      } else {
        await this.client.query("ROLLBACK");
      }
      throw err;
    } finally {
      this.savepointDepth = depth;
    }
  }

  async acquireMigrationLock(): Promise<MigrationLock> {
    const lockKey = 1104;
    await this.client.query(`SELECT pg_advisory_lock(${lockKey})`);
    let released = false;
    return {
      release: async () => {
        if (released) return;
        await this.client.query(`SELECT pg_advisory_unlock(${lockKey})`);
        released = true;
      },
    };
  }

  async close(): Promise<void> {
    if (this.poolManager) {
      await this.poolManager.close();
    } else if (this.client.end) {
      await this.client.end();
    }
  }
}
