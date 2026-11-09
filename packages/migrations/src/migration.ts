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

import type {
  MigrationContext,
  RawSqlStatement,
} from "./migration-context.js";

/** Canonical identity parts of a migration id. */
export interface MigrationIdParts {
  readonly owner: string;
  readonly module: string;
  readonly version: string;
  readonly sequence: number;
  readonly name: string;
}

/** Mode d'exécution d'une migration. */
export type MigrationKind = "sql" | "typescript";

/**
 * A single schema migration (up body, optional rollback, content checksum).
 *
 * Two execution modes are supported:
 *
 * 1. SQL legacy mode (`kind === "sql"`): `content` / `down` are raw SQL
 *    strings executed directly by the Runner. This is the historical format,
 *    preserved for backward compatibility.
 * 2. TypeScript native mode (`kind === "typescript"`): `up` / `downMigration`
 *    are functions receiving a `MigrationContext`. The Runner compiles the
 *    resulting blueprints via the Grammar before execution.
 *
 * The two modes are mutually exclusive: a migration must not declare both
 * `content` and `up`. This invariant is enforced by the MigrationValidator
 * (Phase 04), not by the type system alone.
 */
export interface Migration {
  readonly id: string;
  /** Content checksum computed at load time (R2). */
  readonly checksum: string;
  /**
   * Blueprint of the SQL resources created by this migration (e.g.
   * `["table:users", "index:users.email]`). Declared by the provider;
   * validated by the Planner for resource collisions (R9).
   */
  readonly resources: readonly string[];
  /** Optional list of named migrations or module versions this migration depends on. */
  readonly dependencies?: readonly string[];
  /**
   * Execution mode discriminant. Defaults to `"sql"` for backward
   * compatibility with historical migrations.
   */
  readonly kind?: MigrationKind;
  // ── SQL legacy mode (kind === "sql") ──────────────────────────────
  /** SQL executed on upgrade. Required when kind === "sql". */
  readonly content?: string;
  /** Optional SQL executed on rollback (dev-only, ADR-0006 §12). */
  readonly down?: string;
  // ── TypeScript native mode (kind === "typescript") ────────────────
  /**
   * Upgrade function receiving a MigrationContext. Required when
   * kind === "typescript".
   */
  readonly up?: (context: MigrationContext) => Promise<void> | void;
  /**
   * Optional rollback function receiving a MigrationContext. When absent,
   * the migration is considered irreversible.
   */
  readonly downMigration?: (context: MigrationContext) => Promise<void> | void;
  /**
   * Optional raw SQL statement declared explicitly. Used when the DSL
   * SchemaBuilder is insufficient (dialect-specific DDL, extensions, …).
   * Declaring rawSql makes the migration dialect-dependent.
   */
  readonly rawSql?: RawSqlStatement;
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