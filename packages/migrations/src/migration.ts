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

/** Canonical identity parts of a migration id. */
export interface MigrationIdParts {
  readonly owner: string;
  readonly module: string;
  readonly version: string;
  readonly sequence: number;
  readonly name: string;
}

/** A single schema migration (up body, optional rollback, content checksum). */
export interface Migration {
  readonly id: string;
  /** SQL executed on upgrade. */
  readonly content: string;
  /** Optional SQL executed on rollback (dev-only, ADR-0006 §12). */
  readonly down?: string;
  /** Content checksum computed at load time (R2). */
  readonly checksum: string;
  /**
   * Blueprint of the SQL resources created by this migration (e.g.
   * `["table:users", "index:users.email"]`). Declared by the provider;
   * validated by the Planner for resource collisions (R9).
   */
  readonly resources: readonly string[];
  /** Optional list of named migrations or module versions this migration depends on. */
  readonly dependencies?: readonly string[];
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
  const [owner, module, version, ...rest] = parts;
  if (owner === undefined || module === undefined || version === undefined) {
    throw new Error(`Invalid migration id: ${id}`);
  }
  const tail = rest.join(".");
  const seqIdx = tail.indexOf("_");
  if (seqIdx < 0) {
    throw new Error(`Invalid migration id (missing sequence_name): ${id}`);
  }
  const sequence = Number.parseInt(tail.slice(0, seqIdx), 10);
  const name = tail.slice(seqIdx + 1);
  if (!Number.isFinite(sequence) || name.length === 0) {
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
