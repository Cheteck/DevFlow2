/**
 * Core migration model — aligned with ADR-0006
 * (`.project/decisions/ADR-0006-database-port-migration-engine.md`).
 *
 * The canonical identity of a migration is:
 *
 *   owner.module.version.sequence_name
 *
 * e.g. `identity.users.v1.001_create_users`. The sequence part is compared
 * numerically (R6), never lexically, and the engine never depends on file
 * names.
 */

import { MigrationError } from "./errors.js";
import type { MigrationContext } from "./migration-context.js";

/** Canonical identity parts of a migration id. */
export interface MigrationIdParts {
  readonly owner: string;
  readonly module: string;
  readonly version: string;
  readonly sequence: number;
  readonly name: string;
}

/**
 * Fields of the retired SQL legacy mode.
 *
 * The engine accepts TypeScript native migrations ONLY. A migration
 * declaring one of these fields is rejected — the rule is enforced in code
 * (see {@link assertTypeScriptNativeMigration}), never merely documented.
 *
 * - `content` / `down` / `kind`: the historical SQL-string contract.
 * - `rawSql` / `downRawSql`: the former raw-SQL escape hatch.
 */
export const LEGACY_SQL_FIELDS = [
  "content",
  "down",
  "kind",
  "rawSql",
  "downRawSql",
] as const;

/**
 * Rejects any declaration that carries the retired SQL legacy fields.
 *
 * @throws MigrationError when the candidate declares `content`, `down` or
 *   `kind` — the engine only accepts TypeScript native migrations.
 */
export function assertTypeScriptNativeMigration(
  candidate: unknown,
  migrationId: string,
): void {
  if (typeof candidate !== "object" || candidate === null) {
    throw new MigrationError(
      `Migration "${migrationId}" must be an object describing a TypeScript native migration.`,
    );
  }
  const record = candidate as Record<string, unknown>;
  const found = LEGACY_SQL_FIELDS.filter(
    (field) => record[field] !== undefined,
  );
  if (found.length > 0) {
    throw new MigrationError(
      `Migration "${migrationId}" declares ${found.join(", ")}: the migration engine only accepts ` +
        `TypeScript native migrations (up(context) / downMigration(context)). ` +
        `The SQL legacy mode has been removed.`,
    );
  }
}

/**
 * A single schema migration (up body, optional rollback, content checksum).
 *
 * The engine accepts TypeScript native migrations ONLY:
 *
 * 1. `up(context)` is the mandatory upgrade body. It receives a
 *    `MigrationContext` and declares its schema changes through
 *    `context.schema` (the SchemaBuilder DSL) and its data changes through
 *    `context.data` (the data statements).
 * 2. `downMigration(context)` is the optional rollback body. When absent
 *    the migration is irreversible: a rollback is refused before any
 *    mutation.
 *
 * There is no raw SQL escape hatch: every statement is built from the
 * structured primitives of the engine.
 */
export interface Migration {
  readonly id: string;
  /** Content checksum computed at build time (R2). */
  readonly checksum: string;
  /**
   * Blueprint of the SQL resources created by this migration (e.g.
   * `["table:users", "index:users.email"]`). Declared by the provider;
   * validated by the Planner for resource collisions (R9).
   */
  readonly resources: readonly string[];
  /** Optional list of named migrations or module versions this migration depends on. */
  readonly dependencies?: readonly string[];
  /**
   * Upgrade body. Receives the MigrationContext; the Planner compiles the
   * declared blueprints into SQL statements before the Runner executes them.
   */
  readonly up: (context: MigrationContext) => Promise<void> | void;
  /**
   * Optional rollback body receiving a MigrationContext. When absent, the
   * migration is irreversible.
   */
  readonly downMigration?: (context: MigrationContext) => Promise<void> | void;
  /**
   * Checksums previously recorded in the migration ledger for this
   * migration id. Used when a migration is reworked (e.g. SQL string → Type
   * native) without changing its historical identity: the Planner accepts an
   * executed migration whose checksum belongs to this list.
   *
   * The declared `checksum` always remains the effective one — this list
   * only widens the acceptance window for already-applied migrations.
   */
  readonly legacyChecksums?: readonly string[];
}

/**
 * A source of migrations. The engine is unique and source-agnostic: framework
 * bootstrap and applications are all `MigrationProvider`s carrying an ownerId
 * (R7).
 */
export interface MigrationProvider {
  ownerId(): string;
  migrations(): readonly Migration[];
}

/** Parses a canonical migration id into its parts (R6, R7). */
export function parseMigrationId(id: string): MigrationIdParts {
  const parts = id.split(".");
  if (parts.length < 4) {
    throw new Error(`Invalid migration id: ${id}`);
  }
  const owner = parts[0];
  const module = parts[1];
  // Le version peut contenir des points (ex. "schema.v1") : tous les segments
  // entre le module et le dernier segment (sequence_name) constituent la version.
  const version = parts.slice(2, -1).join(".");
  const lastSegment = parts[parts.length - 1]!;

  // Rejeter les segments vides (ex. "bac..identity.v1.001_name")
  if (owner.length === 0 || module.length === 0 || version.length === 0) {
    throw new Error(
      `Invalid migration id: segments vides non autorisés dans "${id}".`,
    );
  }

  const seqIdx = lastSegment.indexOf("_");
  if (seqIdx < 0) {
    throw new Error(`Invalid migration id (missing sequence_name): ${id}`);
  }
  const sequenceStr = lastSegment.slice(0, seqIdx);
  const name = lastSegment.slice(seqIdx + 1);
  if (name.length === 0) {
    throw new Error(
      `Invalid migration id: le nom de migration ne peut pas être vide dans "${id}".`,
    );
  }

  // Validation stricte : la séquence doit être entièrement numérique
  if (!/^\d+$/.test(sequenceStr)) {
    throw new Error(`Invalid migration id (bad sequence_name): ${id}`);
  }

  const sequence = Number.parseInt(sequenceStr, 10);
  if (!Number.isSafeInteger(sequence)) {
    throw new Error(`Invalid migration id (bad sequence_name): ${id}`);
  }
  return { owner, module, version, sequence, name };
}

/**
 * Numeric comparator for canonical migration ids (R6): owner, then module,
 * then version, then numeric sequence, then name.
 */
export function compareMigrationIds(a: string, b: string): number {
  const pa = parseMigrationId(a);
  const pb = parseMigrationId(b);
  const fields: (keyof MigrationIdParts)[] = ["owner", "module", "version"];
  for (const field of fields) {
    const ca = pa[field];
    const cb = pb[field];
    if (ca < cb) return -1;
    if (ca > cb) return 1;
  }
  if (pa.sequence !== pb.sequence) return pa.sequence - pb.sequence;
  if (pa.name < pb.name) return -1;
  if (pa.name > pb.name) return 1;
  return 0;
}
