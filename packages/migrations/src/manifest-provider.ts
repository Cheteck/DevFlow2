/**
 * @mosaix/migrations — Manifest-based migration discovery (R1).
 *
 * The engine never scans the filesystem: migrations are discovered
 * exclusively through an explicit manifest (ADR-0006 R1). A manifest is the
 * list of migration modules an owner declares; each module exports a
 * TypeScript native `Migration` (the only shape the engine accepts).
 *
 * The former filesystem scanner (`FileMigrationProvider`, which read `.ts`
 * / `.sql` files and produced SQL legacy migrations) has been removed with
 * the SQL legacy mode.
 */

import type { Migration, MigrationProvider } from "./migration.js";

/**
 * Aggregates the migrations declared by the manifest of an owner.
 *
 * The manifest is explicit and static: the modules are imported by the
 * owner (application) and handed over as a list. Nothing is read from the
 * filesystem, and the file names never carry the migration identity.
 */
export class ManifestMigrationProvider implements MigrationProvider {
  constructor(
    private readonly _ownerId: string,
    private readonly entries: readonly Migration[],
  ) {}

  ownerId(): string {
    return this._ownerId;
  }

  migrations(): readonly Migration[] {
    return this.entries;
  }
}
