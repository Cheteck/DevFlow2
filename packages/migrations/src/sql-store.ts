/**
 * @mosaix/migrations — Persistent SQL `MigrationStore` ledger.
 *
 * Framework-owned equivalent of Laravel's `migrations` table: records applied
 * migrations in `mosaix_migrations` so they are never re-applied after a
 * restart. Dialect-aware placeholders (`?` on SQLite, `$n` on Postgres) so
 * the same store serves every driver behind `DatabasePort`.
 *
 * Replaces ad-hoc per-shell ledgers and the prototype-only
 * `InMemoryMigrationStore` (tests/prototypes only — never production).
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { ExecutedMigration, MigrationStore } from "./store";

export class SqlMigrationStore implements MigrationStore {
  private ensured = false;

  constructor(private readonly db: DatabasePort) {}

  private get postgres(): boolean {
    return this.db.capabilities.dialect === "postgres";
  }

  /** Rewrite `?` placeholders to `$1..$n` for Postgres. */
  private bind(sql: string): string {
    if (!this.postgres) return sql;
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  private async ensureLedger(): Promise<void> {
    if (this.ensured) return;
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS mosaix_migrations (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        checksum TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )`,
    );
    this.ensured = true;
  }

  async list(): Promise<readonly ExecutedMigration[]> {
    await this.ensureLedger();
    const rows = await this.db.query<{
      id: string;
      owner: string;
      checksum: string;
      batch_id: string;
      applied_at: string;
    }>(
      `SELECT id, owner, checksum, batch_id, applied_at FROM mosaix_migrations ORDER BY applied_at ASC, id ASC`,
    );
    return rows.map((r) => ({
      id: r.id,
      owner: r.owner,
      checksum: r.checksum,
      batchId: r.batch_id,
      appliedAt: new Date(r.applied_at),
    }));
  }

  async get(id: string): Promise<ExecutedMigration | undefined> {
    await this.ensureLedger();
    const rows = await this.db.query<{
      id: string;
      owner: string;
      checksum: string;
      batch_id: string;
      applied_at: string;
    }>(
      this.bind(
        `SELECT id, owner, checksum, batch_id, applied_at FROM mosaix_migrations WHERE id = ?`,
      ),
      [id],
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      owner: row.owner,
      checksum: row.checksum,
      batchId: row.batch_id,
      appliedAt: new Date(row.applied_at),
    };
  }

  async save(migration: ExecutedMigration): Promise<void> {
    await this.ensureLedger();
    if (this.postgres) {
      await this.db.execute(
        `INSERT INTO mosaix_migrations (id, owner, checksum, batch_id, applied_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET checksum = excluded.checksum, batch_id = excluded.batch_id, applied_at = excluded.applied_at`,
        [
          migration.id,
          migration.owner,
          migration.checksum,
          migration.batchId,
          migration.appliedAt.toISOString(),
        ],
      );
      return;
    }
    await this.db.execute(
      `INSERT INTO mosaix_migrations (id, owner, checksum, batch_id, applied_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET checksum = excluded.checksum, batch_id = excluded.batch_id, applied_at = excluded.applied_at`,
      [
        migration.id,
        migration.owner,
        migration.checksum,
        migration.batchId,
        migration.appliedAt.toISOString(),
      ],
    );
  }

  async remove(id: string): Promise<void> {
    await this.ensureLedger();
    await this.db.execute(
      this.bind(`DELETE FROM mosaix_migrations WHERE id = ?`),
      [id],
    );
  }
}
