/**
 * Domain errors for the migration engine — aligned with ADR-0006 and the
 * error hierarchy of PRD-0006 §33.
 *
 * ```
 * MigrationError
 * ├── MigrationConflictError
 * ├── MigrationChecksumError
 * ├── MigrationMissingError
 * ├── MigrationAlreadyAppliedError
 * ├── MigrationLockError
 * ├── MigrationTransactionError
 * ├── MigrationExecutionError
 * └── (Phase 2) MigrationCompilationError, BlueprintValidationError
 * ```
 */

/** Base error for the migration engine (PRD-0006 §33). */
export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

/** Collision of a full migration identity at load time, in the Registry (R9). */
export class MigrationConflictError extends MigrationError {
  readonly conflictingId: string;
  readonly owners: readonly string[];

  constructor(conflictingId: string, owners: readonly string[]) {
    super(
      `Migration conflict: "${conflictingId}" is declared by multiple owners: ${owners.join(", ")}`,
    );
    this.name = "MigrationConflictError";
    this.conflictingId = conflictingId;
    this.owners = owners;
  }
}

/** A migration present in the Store but absent from the Registry (R5). */
export class MigrationMissingError extends MigrationError {
  readonly migrationId: string;

  constructor(migrationId: string) {
    super(
      `Migration "${migrationId}" exists in the Store but is missing from the Registry`,
    );
    this.name = "MigrationMissingError";
    this.migrationId = migrationId;
  }
}

/** A migration was modified after being applied (R2, immutability). */
export class MigrationChecksumError extends MigrationError {
  readonly migrationId: string;
  readonly expectedChecksum: string;
  readonly actualChecksum: string;

  constructor(
    migrationId: string,
    expectedChecksum: string,
    actualChecksum: string,
  ) {
    super(
      `Migration "${migrationId}" was modified after being applied (checksum mismatch)`,
    );
    this.name = "MigrationChecksumError";
    this.migrationId = migrationId;
    this.expectedChecksum = expectedChecksum;
    this.actualChecksum = actualChecksum;
  }
}

/** A migration is already applied and cannot be applied again (PRD §24). */
export class MigrationAlreadyAppliedError extends MigrationError {
  readonly migrationId: string;

  constructor(migrationId: string) {
    super(`Migration "${migrationId}" is already applied`);
    this.name = "MigrationAlreadyAppliedError";
    this.migrationId = migrationId;
  }
}

/** The migration lock could not be acquired (PRD §28). */
export class MigrationLockError extends MigrationError {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "MigrationLockError";
    this.cause = cause;
  }
}

/** A migration transaction failed to begin/commit/rollback (PRD §26, §32). */
export class MigrationTransactionError extends MigrationError {
  readonly migrationId?: string | undefined;
  override readonly cause?: unknown;

  constructor(message: string, migrationId?: string, cause?: unknown) {
    super(message);
    this.name = "MigrationTransactionError";
    this.migrationId = migrationId;
    this.cause = cause;
  }
}

/** SQL execution of a migration failed (PRD §32). */
export class MigrationExecutionError extends MigrationError {
  readonly migrationId?: string | undefined;
  override readonly cause?: unknown;

  constructor(message: string, migrationId?: string, cause?: unknown) {
    super(message);
    this.name = "MigrationExecutionError";
    this.migrationId = migrationId;
    this.cause = cause;
  }
}

/**
 * Collision of a SQL resource between migrations at Blueprint level (R9) —
 * distinct from identity collisions (Registry-level).
 */
export class MigrationResourceConflictError extends MigrationError {
  readonly resource: string;
  readonly migrations: readonly string[];

  constructor(resource: string, migrations: readonly string[]) {
    super(
      `SQL resource collision: "${resource}" is created by multiple migrations: ${migrations.join(", ")}`,
    );
    this.name = "MigrationResourceConflictError";
    this.resource = resource;
    this.migrations = migrations;
  }
}
