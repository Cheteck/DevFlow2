/**
 * MigrationRegistry — aggregates `MigrationProvider` / `MigrationSource`
 * implementations and orders them deterministically by natural timestamp.
 *
 * Simplified Laravel-like Multi-App Migration Architecture.
 *
 * Phase 03: `RawMigration` accepts both the historical SQL format
 * (`content`/`down` as strings) and the new TypeScript native format
 * (`up`/`downMigration` as functions, `kind: "typescript"`).
 */

import { computeChecksum } from "./checksum.js";
import {
  MigrationChecksumError,
  MigrationConflictError,
} from "./errors.js";
import {
  MigrationValidator,
  MigrationValidationError,
} from "./validator.js";
import type { Migration, MigrationProvider } from "./migration.js";
import type { RawSqlStatement } from "./migration-context.js";
import { compareMigrationIds } from "./migration.js";

export interface RawMigration {
  readonly id: string;
  /** SQL executed on upgrade (legacy mode). Optional when kind === "typescript". */
  readonly content?: string;
  /** Optional SQL executed on rollback (legacy mode). */
  readonly down?: string;
  /** Execution mode discriminant. Defaults to "sql" for backward compatibility. */
  readonly kind?: "sql" | "typescript";
  /**
   * Upgrade function (TypeScript native mode). Required when kind === "typescript".
   */
  readonly up?: (context: unknown) => Promise<void> | void;
  /**
   * Optional rollback function (TypeScript native mode). Required when kind === "typescript" and reversible.
   */
  readonly downMigration?: (context: unknown) => Promise<void> | void;
  /** Optional raw SQL statement declared explicitly. */
  readonly rawSql?: RawSqlStatement;
  readonly resources?: readonly string[];
  readonly dependencies?: readonly string[];
  /**
   * Explicit checksum generated at build time from the migration source content.
   * When provided, it is used as-is instead of being recomputed. This guarantees
   * that two migrations with the same declared structure but different up()
   * bodies produce different checksums. Generation is the responsibility of the
   * build tooling (e.g. a hash of the migration module source).
   */
  readonly checksum?: string;
}

/**
 * Loads a raw migration declaration into a typed `Migration`.
 *
 * Checksum strategy:
 * - Legacy SQL migrations: checksum of `content` (historical behavior, R2).
 * - TypeScript native migrations without `content`: checksum of the declared
 *   structure (id, resources, dependencies, kind, rawSql) — never the function
 *   body itself, as `Function.toString()` is not a stable content hash
 *   (reserve B from architectural review).
 */
function stableStructureChecksum(raw: RawMigration): string {
  return computeChecksum(
    JSON.stringify({
      id: raw.id,
      kind: raw.kind,
      resources: raw.resources ?? [],
      dependencies: raw.dependencies ?? [],
      rawSql: raw.rawSql,
    }),
  );
}

export function loadMigration(raw: RawMigration): Migration {
  const kind = raw.kind ?? "sql";

  // Checksum resolution order:
  // 1. Explicit checksum provided at build time (required for TypeScript
  //    native migrations; covers the actual source content).
  // 2. Legacy SQL: checksum of content (historical behavior, R2).
  // 3. TypeScript native without explicit checksum: ERROR — a build-time
  //    checksum is mandatory for TypeScript migrations.
  let checksum: string;
  if (raw.checksum !== undefined && raw.checksum.length > 0) {
    checksum = raw.checksum;
  } else if (kind === "sql" && raw.content !== undefined) {
    checksum = computeChecksum(raw.content);
  } else if (kind === "typescript") {
    throw new MigrationChecksumError(
      raw.id,
      "explicit build-time checksum",
      "missing",
    );
  } else {
    checksum = stableStructureChecksum(raw);
  }

  const migration: Migration = {
    id: raw.id,
    checksum,
    kind,
    resources: raw.resources ?? [],
    ...(raw.content !== undefined ? { content: raw.content } : {}),
    ...(raw.down !== undefined ? { down: raw.down } : {}),
    ...(raw.up !== undefined ? { up: raw.up as Migration["up"] } : {}),
    ...(raw.downMigration !== undefined
      ? { downMigration: raw.downMigration as Migration["downMigration"] }
      : {}),
    ...(raw.rawSql !== undefined ? { rawSql: raw.rawSql } : {}),
    ...(raw.dependencies !== undefined
      ? { dependencies: raw.dependencies }
      : {}),
  };
  return migration;
}

export class MigrationRegistry {
  private readonly entries: { rank: number; migration: Migration }[] = [];
  private readonly byId = new Map<string, Migration>();
  private readonly ownerById = new Map<string, string>();

  register(provider: MigrationProvider, rank = 0): void {
    const ownerId = provider.ownerId();

    // Phase 1 : Charger toutes les migrations du provider sans les enregistrer.
    const pending: Migration[] = [];
    for (const raw of provider.migrations()) {
      const migration = loadMigration(raw as unknown as RawMigration);
      pending.push(migration);
    }

    // Phase 2 : Valider l'ENSEMBLE des migrations avant toute modification
    // des structures internes du Registry. Si une seule migration du lot est
    // invalide, aucune migration n'est enregistrée (atomicité).
    const validator = new MigrationValidator();
    const batchResult = validator.validateBatch(pending);
    if (batchResult !== undefined) {
      throw new MigrationValidationError(
        pending[0]!.id,
        batchResult.errors,
      );
    }

    // Phase 3 : Vérifier les collisions d'identité avant l'enregistrement.
    // Aucune migration n'est enregistrée si une collision est détectée.
    for (const migration of pending) {
      const existing = this.byId.get(migration.id);
      if (existing !== undefined) {
        throw new MigrationConflictError(migration.id, [
          this.ownerById.get(migration.id) ?? "unknown",
          ownerId,
        ]);
      }
    }

    // Phase 4 : Enregistrer toutes les migrations validées.
    for (const migration of pending) {
      this.byId.set(migration.id, migration);
      this.ownerById.set(migration.id, ownerId);
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