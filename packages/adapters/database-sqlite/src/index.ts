import { DatabaseSync } from "node:sqlite";
import type {
  DatabaseCapabilities,
  DatabaseConnection,
  DatabasePort,
  MigrationLock,
} from "@mosaix/ports-database";

export interface SQLiteDriver {
  execute(sql: string, params?: readonly unknown[]): Promise<number>;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close?(): void;
}

type SqlValue = string | number | bigint | null | Uint8Array;

function toSqlParams(params?: readonly unknown[]): SqlValue[] | undefined {
  if (params === undefined) return undefined;
  return params.map((p) => p as SqlValue);
}

export class NodeSQLiteDriver implements SQLiteDriver {
  private readonly db: DatabaseSync;

  constructor(location = ":memory:") {
    this.db = new DatabaseSync(location);
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    if (params !== undefined) {
      const sqlParams = toSqlParams(params) ?? [];
      const changes = this.db.prepare(sql).run(...sqlParams).changes;
      return Number(changes);
    }
    this.db.exec(sql);
    return 0;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const sqlParams = toSqlParams(params);
    const rows = sqlParams !== undefined ? stmt.all(...sqlParams) : stmt.all();
    return rows as T[];
  }

  async begin(): Promise<void> {
    this.db.exec("BEGIN");
  }

  async commit(): Promise<void> {
    this.db.exec("COMMIT");
  }

  async rollback(): Promise<void> {
    this.db.exec("ROLLBACK");
  }

  close(): void {
    this.db.close();
  }
}

/**
 * SQLite `DatabasePort` adapter. Driver-agnostic via `SQLiteDriver` interface.
 */
export class SQLiteDatabaseAdapter implements DatabasePort {
  readonly capabilities: DatabaseCapabilities = {
    dialect: "sqlite",
    transactions: true,
    lock: { distributed: false, processSafe: true, runtimeSafe: true },
  };

  private readonly driver: SQLiteDriver;
  private savepointDepth = 0;

  constructor(driverOrLocation: SQLiteDriver | string = ":memory:") {
    if (typeof driverOrLocation === "string") {
      this.driver = new NodeSQLiteDriver(driverOrLocation);
    } else {
      this.driver = driverOrLocation;
    }
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<number> {
    return this.driver.execute(sql, params);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]> {
    return this.driver.query<T>(sql, params);
  }

  async transaction<T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    const depth = this.savepointDepth;
    const savepoint = `mosaix_tx_${depth}`;
    this.savepointDepth++;
    try {
      if (depth > 0) {
        await this.driver.execute(`SAVEPOINT ${savepoint}`);
      } else {
        await this.driver.begin();
      }
      const tx: DatabaseConnection = {
        execute: (sql, params) => this.execute(sql, params),
        query: (sql, params) => this.query(sql, params),
      };
      const result = await fn(tx);
      if (depth > 0) {
        await this.driver.execute(`RELEASE ${savepoint}`);
      } else {
        await this.driver.commit();
      }
      return result;
    } catch (err) {
      if (depth > 0) {
        await this.driver.execute(`ROLLBACK TO ${savepoint}`);
        await this.driver.execute(`RELEASE ${savepoint}`);
      } else {
        await this.driver.rollback();
      }
      throw err;
    } finally {
      this.savepointDepth = depth;
    }
  }

  async acquireMigrationLock(): Promise<MigrationLock> {
    await this.driver.execute("BEGIN EXCLUSIVE");
    this.savepointDepth = 1;
    let released = false;
    return {
      release: async () => {
        if (released) return;
        await this.driver.execute("COMMIT");
        this.savepointDepth = 0;
        released = true;
      },
    };
  }

  close(): void {
    if (this.driver.close) {
      this.driver.close();
    }
  }
}
