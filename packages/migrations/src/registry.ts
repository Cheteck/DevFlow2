/**
 * MigrationRegistry — aggregates `MigrationProvider` / `MigrationSource`
 * implementations and orders them deterministically by natural timestamp.
 *
 * Simplified Laravel-like Multi-App Migration Architecture.
 */

import { computeChecksum } from "./checksum";
import { MigrationConflictError } from "./errors";
import type { Migration, MigrationProvider } from "./migration";
import { compareMigrationIds } from "./migration";

export interface RawMigration {
  readonly id: string;
  readonly content: string;
  readonly down?: string;
  readonly resources?: readonly string[];
  readonly dependencies?: readonly string[];
}

export function loadMigration(raw: RawMigration): Migration {
  return {
    id: raw.id,
    content: raw.content,
    ...(raw.down !== undefined ? { down: raw.down } : {}),
    checksum: computeChecksum(raw.content),
    resources: raw.resources ?? [],
    ...(raw.dependencies !== undefined
      ? { dependencies: raw.dependencies }
      : {}),
  };
}

export class MigrationRegistry {
  private readonly entries: { rank: number; migration: Migration }[] = [];
  private readonly byId = new Map<string, Migration>();
  private readonly ownerById = new Map<string, string>();

  register(provider: MigrationProvider, rank = 0): void {
    for (const raw of provider.migrations()) {
      const migration = loadMigration(raw);
      const existing = this.byId.get(migration.id);
      if (existing !== undefined) {
        throw new MigrationConflictError(migration.id, [
          this.ownerById.get(migration.id) ?? "unknown",
          provider.ownerId(),
        ]);
      }
      this.byId.set(migration.id, migration);
      this.ownerById.set(migration.id, provider.ownerId());
      this.entries.push({ rank, migration });
    }
  }

  all(): readonly Migration[] {
    return this.entries
      .slice()
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return compareMigrationIds(a.migration.id, b.migration.id);
      })
      .map((e) => e.migration);
  }

  get(id: string): Migration | undefined {
    return this.byId.get(id);
  }

  ownerOf(id: string): string | undefined {
    return this.ownerById.get(id);
  }
}
