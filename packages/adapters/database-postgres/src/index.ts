import type {
  DatabaseCapabilities,
  DatabaseConnection,
  DatabasePort,
  MigrationLock,
} from "@mosaix/ports-database";
import { Pool } from "pg";

export interface PgQueryResult {
  readonly rows: readonly unknown[];
  readonly rowCount?: number | null;
}

export interface PgClient {
  query(sql: string, params?: readonly unknown[]): Promise<PgQueryResult>;
  connect?(): Promise<void>;
  release?(): Promise<void> | void;
  end?(): Promise<void>;
  /**
   * Checks out ONE dedicated connection from the pool (true per-connection
   * transactions). Absent on single-client fakes — `transaction()` then uses
   * the legacy savepoint path.
   */
  checkout?(): Promise<PooledConnection>;
}

/** Single pooled connection: every statement shares one backend session. */
export interface PooledConnection {
  query(sql: string, params?: readonly unknown[]): Promise<PgQueryResult>;
  release(): Promise<void> | void;
}

export interface PostgresPoolOptions {
  readonly connectionString?: string;
  readonly maxConnections?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
  readonly healthCheckIntervalMillis?: number;
}

/**
 * Rewrites SQLite-style `?` placeholders to positional `$n` parameters.
 * Already-positional SQL (`$1`) passes through unchanged. `??` is left
 * alone. Limitation: raw PostgreSQL JSON operators (`?`, `?|`, `?&`)
 * cannot be distinguished from placeholders — write them with an
 * immediately following `?` escape or, preferably, avoid them in
 * port-level queries (use `json_extract`-style functions instead).
 */
export function translatePlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?\?|\?/g, (match) => (match === "??" ? match : `$${++index}`));
}

/**
 * Resilient Connection Pool Manager for PostgreSQL.
 * Manages client acquisition, health checks, transient error retries, and graceful termination.
 */
export class PostgresPoolManager {
  private readonly clients: Set<PgClient> = new Set();
  private sharedClient: PgClient | null = null;
  private isClosed = false;

  constructor(
    private readonly clientFactory: () => PgClient,
    private readonly options: PostgresPoolOptions = {}
  ) {}

  async acquireClient(): Promise<PgClient> {
    if (this.isClosed) {
      throw new Error("PostgresPoolManager has been closed.");
    }

    // The factory product is a long-lived shared handle (a pg Pool wrapper):
    // creating one per acquisition leaked a backend connection per query
    // ("too many clients already" past ~100 statements). Acquire once.
    if (!this.sharedClient) {
      const client = this.clientFactory();
      if (client.connect) {
        await client.connect();
      }
      this.sharedClient = client;
      this.clients.add(client);
    }
    return this.sharedClient;
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
        // Logical return only: the factory product is shared (see
        // acquireClient) — removing it here would break close() tracking
        // without freeing anything.
        if (client) {
          if (client.release) {
            await client.release();
          }
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

  /**
   * Checks out a dedicated pooled connection when the factory product
   * supports it; otherwise falls back to the shared handle (no real
   * isolation — same limitation as the legacy transaction path).
   */
  async checkout(): Promise<PooledConnection> {
    const shared = await this.acquireClient();
    if (shared.checkout) {
      return shared.checkout();
    }
    return {
      query: (sql, params) => shared.query(sql, params),
      release: async () => {},
    };
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
 *
 * Placeholder convention: callers write SQLite-style `?` placeholders;
 * the adapter rewrites them to positional `$n` on the way in, so the same
 * queries run on both drivers. `??` is left untouched. Limitation: raw
 * PostgreSQL JSON operators (`?`, `?|`, `?&`) are indistinguishable from
 * placeholders and get rewritten — port-level queries must avoid them
 * (no such usage exists in the codebase as of 2026-09-26).
 */
export class PostgresDatabaseAdapter implements DatabasePort {
  readonly capabilities: DatabaseCapabilities = {
    dialect: "postgres",
    transactions: true,
    lock: { distributed: true, processSafe: true, runtimeSafe: true },
  };

  private readonly client: PgClient;
  private readonly poolManager?: PostgresPoolManager;
  private readonly checkoutDedicated: (() => Promise<PooledConnection>) | undefined;
  private savepointDepth = 0;

  constructor(clientOrPool: PgClient | PostgresPoolManager) {
    if (clientOrPool instanceof PostgresPoolManager) {
      this.poolManager = clientOrPool;
      this.checkoutDedicated = () => clientOrPool.checkout();
      this.client = {
        query: (sql, params) =>
          clientOrPool.executeWithRetry((c) => c.query(sql, params)),
      };
    } else {
      this.client = clientOrPool;
      this.checkoutDedicated = clientOrPool.checkout
        ? () => (clientOrPool.checkout as () => Promise<PooledConnection>)()
        : undefined;
    }
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    const res = await this.client.query(translatePlaceholders(sql), params);
    return res.rowCount ?? 0;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<T[]> {
    const res = await this.client.query(translatePlaceholders(sql), params);
    return res.rows as unknown as T[];
  }

  async transaction<T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    // Real atomicity needs ONE backend session for the whole fn. Pool-backed
    // ports check out a dedicated connection; single-client fakes (tests)
    // keep the legacy savepoint path. Nested real transactions are NOT
    // multiplexed (no ALS): inner calls share the outer connection via
    // savepoints, exactly like the legacy path.
    if (this.savepointDepth === 0 && this.checkoutDedicated) {
      const conn = await this.checkoutDedicated();
      const tx: DatabaseConnection = {
        execute: async (sql: string, params?: readonly unknown[]) => {
          const res = await conn.query(translatePlaceholders(sql), params);
          return res.rowCount ?? 0;
        },
        query: async <R = Record<string, unknown>>(
          sql: string,
          params?: readonly unknown[],
        ) => {
          const res = await conn.query(translatePlaceholders(sql), params);
          return res.rows as unknown as R[];
        },
      };
      await conn.query("BEGIN");
      try {
        const result = await fn(tx);
        await conn.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await conn.query("ROLLBACK");
        } catch {
          // Rollback failure must not mask the original error.
        }
        throw err;
      } finally {
        await conn.release();
      }
    }
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

/**
 * Builds a `PgClient` over a `pg` connection pool. Single composition point
 * for real PostgreSQL connectivity (shell bootstrap + CLI share it).
 */
export function createPgPoolClient(connectionString?: string): PgClient {
  const pool = connectionString !== undefined ? new Pool({ connectionString }) : new Pool();
  return {
    query: async (sql: string, params?: readonly unknown[]) => {
      const result = await pool.query(sql, [...(params ?? [])]);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    checkout: async () => {
      const client = await pool.connect();
      return {
        query: async (sql: string, params?: readonly unknown[]) => {
          const result = await client.query(sql, [...(params ?? [])]);
          return { rows: result.rows, rowCount: result.rowCount };
        },
        release: () => client.release(),
      };
    },
    end: async () => {
      await pool.end();
    },
  };
}

/**
 * Builds a pool-managed `PostgresDatabaseAdapter` from a connection string
 * (or the standard `PG*` env vars when omitted).
 */
export function createPostgresDatabasePort(connectionString?: string): PostgresDatabaseAdapter {
  const manager = new PostgresPoolManager(() => createPgPoolClient(connectionString));
  return new PostgresDatabaseAdapter(manager);
}
