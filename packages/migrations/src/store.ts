/**
 * MigrationStore — persistence of applied migrations, keeping the origin
 * (owner) of each one (ADR-0006 §13). The store is the source of truth for
 * the applied state; the Planner compares the Registry (desired) against the
 * Store (current) to produce the plan (R12).
 */

/** A migration recorded as applied in the Store. */
export interface ExecutedMigration {
  readonly id: string;
  /** The owner that declared the migration (origin, R7/§13). */
  readonly owner: string;
  /** Content checksum recorded at execution time (R2). */
  readonly checksum: string;
  /**
   * Batch this migration was executed in (PRD §30). All migrations executed
   * during one Runner invocation share the same batch id. Rollback without
   * parameters undoes the last batch.
   */
  readonly batchId: string;
  readonly appliedAt: Date;
}

/**
 * Persistence contract for the executed-migration ledger. Implementations are
 * storage adapters (SQL table, in-memory, ...). This interface keeps the
 * engine storage-agnostic. `list()` must return migrations in application
 * order (oldest first) so the Planner can roll back in reverse order (PRD §29).
 */
export interface MigrationStore {
  /** Returns all executed migrations in application order (oldest first). */
  list(): Promise<readonly ExecutedMigration[]>;
  /** Returns a single executed migration, if present. */
  get(id: string): Promise<ExecutedMigration | undefined>;
  /** Records a migration as applied. */
  save(migration: ExecutedMigration): Promise<void>;
  /** Removes a migration from the ledger (rollback). */
  remove(id: string): Promise<void>;
}

/** In-memory `MigrationStore` — for tests and prototypes (spike scope). */
export class InMemoryMigrationStore implements MigrationStore {
  private readonly entries: ExecutedMigration[] = [];

  async list(): Promise<readonly ExecutedMigration[]> {
    return [...this.entries];
  }

  async get(id: string): Promise<ExecutedMigration | undefined> {
    return this.entries.find((e) => e.id === id);
  }

  async save(migration: ExecutedMigration): Promise<void> {
    this.entries.push({ ...migration });
  }

  async remove(id: string): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx >= 0) this.entries.splice(idx, 1);
  }
}
