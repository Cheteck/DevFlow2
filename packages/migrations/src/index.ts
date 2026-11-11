/**
 * @mosaix/migrations — MosaiX Migration Engine (ADR-0006 spike).
 *
 * Source-agnostic schema migration engine: the Registry aggregates providers,
 * the Planner decides (deterministic delta → immutable plan), the Runner
 * executes. The engine depends only on `@mosaix/ports-database`.
 */

export { computeChecksum } from "./checksum.js";
export {
  value,
  constant,
  column,
  jsonPath,
  cast,
  nullIf,
  matches,
  func,
  count,
  inList,
  subquery,
  equals,
  isNull,
  isNotNull,
  compare,
  matchesPattern,
  inValues,
  inSubquery,
  notExists,
  select,
} from "./expressions.js";
export type {
  Expression,
  Condition,
  SelectStatement,
  SelectTable,
} from "./expressions.js";
export {
  computeSourceChecksum,
  normalizeSource,
  readSourceChecksum,
  sha256Hex,
  stripChecksumBlock,
  withSourceChecksum,
  CHECKSUM_BLOCK_BEGIN,
  CHECKSUM_BLOCK_END,
} from "./source-checksum.js";
export {
  MigrationError,
  MigrationAlreadyAppliedError,
  MigrationConflictError,
  MigrationMissingError,
  MigrationChecksumError,
  MigrationLockError,
  MigrationTransactionError,
  MigrationExecutionError,
  MigrationResourceConflictError,
} from "./errors.js";
export type {
  Migration,
  MigrationIdParts,
  MigrationProvider,
} from "./migration.js";
export {
  compareMigrationIds,
  parseMigrationId,
  assertTypeScriptNativeMigration,
  LEGACY_SQL_FIELDS,
} from "./migration.js";
export type {
  MigrationContext,
  MigrationLogger,
  MigrationRuntime,
} from "./migration-context.js";
export type {
  MigrationPlan,
  PlannedMigration,
  RollbackTarget,
} from "./planner.js";
export {
  MigrationPlanner,
  computeSourceVersion,
  DEFAULT_MIGRATION_RUNTIME,
} from "./planner.js";
export { DependencyResolver } from "./dependency-resolver.js";
export type { MigrationStore, ExecutedMigration } from "./store.js";
export { InMemoryMigrationStore } from "./store.js";
export { SqlMigrationStore } from "./sql-store.js";
export type { RawMigration } from "./registry.js";
export { MigrationRegistry, loadMigration } from "./registry.js";
export {
  MigrationValidator,
  MigrationValidationError,
  type ValidationResult,
} from "./validator.js";
export { MigrationCompiler, type CompilationResult } from "./compiler.js";
export { ManifestMigrationProvider } from "./manifest-provider.js";
export { MigrationRunner, newBatchId } from "./runner.js";
export type { RunResult } from "./runner.js";

// Re-export CLI command handlers (Phase 5)
export type { MigrationStatus } from "./cli.js";
export { MigrationCLI } from "./cli.js";

// Re-export SchemaBuilder and Grammars for Phase 2
export type {
  Blueprint,
  ColumnDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  CreateTableBlueprint,
  DropTableBlueprint,
  AddColumnBlueprint,
  DropColumnBlueprint,
  RenameColumnBlueprint,
  RenameTableBlueprint,
  CreateIndexBlueprint,
} from "./schema-builder.js";
export {
  SchemaBuilder,
  TableBuilder,
  ColumnBuilder,
} from "./schema-builder.js";
export type { SqlStatement, Grammar } from "./grammar.js";
export { SQLiteGrammar, PostgresGrammar } from "./grammar.js";

// Re-export the database port so consumers of the engine only depend on
// @mosaix/migrations for both engine and storage contracts.
export type {
  DatabasePort,
  DatabaseCapabilities,
  Dialect,
  LockCapabilities,
  MigrationLock,
  DatabaseConnection,
} from "@mosaix/ports-database";
