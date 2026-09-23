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
}

/**
 * PostgreSQL `DatabasePort` adapter. Duck-typed constructor accepting any pg-compatible client/pool.
 */
export class PostgresDatabaseAdapter implements DatabasePort {
  readonly capabilities: DatabaseCapabilities = {
    dialect: "postgres",
    transactions: true,
    lock: { distributed: true, processSafe: true, runtimeSafe: true },
  };

  private readonly client: PgClient;
  private savepointDepth = 0;

  constructor(client: PgClient) {
    this.client = client;
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    const res = await this.client.query(sql, params);
    return res.rowCount ?? 0;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
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
}
