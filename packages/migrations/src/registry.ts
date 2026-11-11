/**
 * MigrationRegistry — aggregates `MigrationProvider` / `MigrationSource`
 * implementations and orders them deterministically by natural timestamp.
 *
 * Simplified Laravel-like Multi-App Migration Architecture.
 *
 * The engine accepts TypeScript native migrations ONLY: `loadMigration`
 * rejects any declaration carrying the retired SQL legacy fields
 * (`content`, `down`, `kind`) — the rule is enforced in code.
 */

import { MigrationConflictError, MigrationError } from "./errors.js";
import { MigrationValidator, MigrationValidationError } from "./validator.js";
import type { Migration, MigrationProvider } from "./migration.js";
import { assertTypeScriptNativeMigration } from "./migration.js";
import { compareMigrationIds } from "./migration.js";

export interface RawMigration {
  readonly id: string;
  /**
   * Upgrade body (TypeScript native). Mandatory.
   */
  readonly up: (context: unknown) => Promise<void> | void;
  /**
   * Optional rollback body (TypeScript native).
   */
  readonly downMigration?: (context: unknown) => Promise<void> | void;
  /**
   * Checksums previously recorded in the ledger for this migration id.
   * Accepted by the Planner as equivalent to `checksum` (historical identity
   * preserved when a migration is reworked).
   */
  readonly legacyChecksums?: readonly string[];
  readonly resources?: readonly string[];
  readonly dependencies?: readonly string[];
  /**
   * Explicit checksum generated at build time from the migration source
   * content. When provided, it is used as-is instead of being recomputed.
   * This guarantees that two migrations with the same declared structure but
   * different up() bodies produce different checksums. Generation is the
   * responsibility of the build tooling (`scripts/migration-checksums.ts`).
   */
  readonly checksum?: string;
}

/**
 * Loads a raw migration declaration into a typed `Migration`.
 *
 * Checksum strategy: the checksum is always explicit and provided at build
 * time from the migration source. It is mandatory: a migration without a
 * declared checksum is rejected (`MigrationChecksumError`), because a
 * checksum computed from the function body (`Function.toString()`) is not
 * stable across transpilation.
 */
export function loadMigration(raw: RawMigration): Migration {
  // The engine only accepts TypeScript native migrations.
  assertTypeScriptNativeMigration(raw, raw?.id ?? "<unknown>");

  if (typeof raw.up !== "function") {
    throw new MigrationError(
      `Migration "${raw.id}" must declare an up(context) function: the engine only accepts ` +
        `TypeScript native migrations.`,
    );
  }

  if (raw.checksum === undefined || raw.checksum.length === 0) {
    throw new MigrationError(
      `Migration "${raw.id}" must declare an explicit build-time checksum. ` +
        `Run \`pnpm migration:checksums\` to compute it from the migration source.`,
    );
  }

  const migration: Migration = {
    id: raw.id,
    checksum: raw.checksum,
    resources: raw.resources ?? [],
    up: raw.up as Migration["up"],
    ...(raw.downMigration !== undefined
      ? { downMigration: raw.downMigration as Migration["downMigration"] }
      : {}),
    ...(raw.legacyChecksums !== undefined
      ? { legacyChecksums: raw.legacyChecksums }
      : {}),
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
      throw new MigrationValidationError(pending[0]!.id, batchResult.errors);
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
