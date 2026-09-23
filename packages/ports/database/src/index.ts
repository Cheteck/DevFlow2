/**
 * DatabasePort — Decouples MosaiX schema access and migration locking from the
 * concrete storage engine (PostgreSQL, SQLite Node, SQLite WASM/OPFS).
 *
 * Aligned with ADR-0006 (`.project/decisions/ADR-0006-database-port-migration-engine.md`):
 * - the migration engine depends only on this port (R2);
 * - SQL is generated exclusively by a Grammar, never by adapters (R2);
 * - concurrency guarantees belong to the adapter, exposed via
 *   `DatabaseCapabilities.lock` (R3).
 */

export type Dialect = "postgres" | "sqlite";

/** Concurrency guarantees a storage adapter actually provides (ADR-0006 §4). */
export interface LockCapabilities {
  /** Lock holds across processes/machines (e.g. PostgreSQL advisory lock). */
  readonly distributed: boolean;
  /** Lock is safe across processes on the same runtime (e.g. `BEGIN EXCLUSIVE`). */
  readonly processSafe: boolean;
  /** Lock is safe within a single runtime instance only (single-writer). */
  readonly runtimeSafe: boolean;
}

/** Storage capabilities advertised by an adapter (ADR-0006 §2, §4). */
export interface DatabaseCapabilities {
  readonly dialect: Dialect;
  /** True when the engine supports multi-statement transactions. */
  readonly transactions: boolean;
  /** Concurrency guarantee provided by `acquireMigrationLock`. */
  readonly lock: LockCapabilities;
}

/** A schema-execution handle (statement stream, used by the Runner). */
export interface DatabaseConnection {
  /** Executes a single SQL statement, returns affected row count. */
  execute(sql: string, params?: readonly unknown[]): Promise<number>;
  /** Runs a query and returns the rows. */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
}

/** Exclusive migration lock owned by an adapter (ADR-0006 §4). */
export interface MigrationLock {
  /** Releases the lock. Must be idempotent. */
  release(): Promise<void>;
}

/**
 * DatabasePort — minimal schema-execution surface consumed by
 * `@mosaix/migrations`. Transaction semantics are adapter-owned: the adapter
 * may execute statements in autocommit or batched mode depending on
 * capabilities.
 */
export interface DatabasePort {
  readonly capabilities: DatabaseCapabilities;

  /** Runs a statement stream (migration body / cleanup). */
  execute(sql: string, params?: readonly unknown[]): Promise<number>;

  /** Reads schema/state rows (Store persistence, audit). */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;

  /**
   * Runs `fn` inside a transaction, giving per-migration atomicity (PRD §26).
   * The adapter owns BEGIN/COMMIT/ROLLBACK semantics: when
   * `capabilities.transactions` is true the whole `fn` is atomic (COMMIT on
   * success, ROLLBACK on throw); when false the adapter executes `fn` with
   * autocommit semantics and `DatabaseConnection` maps to the adapter itself.
   */
  transaction<T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T>;

  /**
   * Acquires the exclusive migration lock. The guarantee actually provided is
   * described by `capabilities.lock`; adapters without a real lock still
   * return a `MigrationLock` but expose a `runtimeSafe` capability only.
   */
  acquireMigrationLock(): Promise<MigrationLock>;
}
