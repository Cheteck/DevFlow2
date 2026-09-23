/**
 * @mosaix/migrations — MosaiX Migration Engine (ADR-0006 spike).
 *
 * Source-agnostic schema migration engine: the Registry aggregates providers,
 * the Planner decides (deterministic delta → immutable plan), the Runner
 * executes. The engine depends only on `@mosaix/ports-database`.
 */

export { computeChecksum } from "./checksum";
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
} from "./errors";
export type {
  Migration,
  MigrationIdParts,
  MigrationProvider,
} from "./migration";
export { compareMigrationIds, parseMigrationId } from "./migration";
export type {
  MigrationPlan,
  PlannedMigration,
  RollbackTarget,
} from "./planner";
export { MigrationPlanner, computeSourceVersion } from "./planner";
export { DependencyResolver } from "./dependency-resolver";
export type { MigrationStore, ExecutedMigration } from "./store";
export { InMemoryMigrationStore } from "./store";
export type { RawMigration } from "./registry";
export {
  MigrationRegistry,
  loadMigration,
} from "./registry";
export { FileMigrationProvider } from "./file-provider";
export { MigrationRunner, newBatchId } from "./runner";
export type { RunResult } from "./runner";

// Re-export CLI command handlers (Phase 5)
export type { MigrationStatus } from "./cli";
export { MigrationCLI } from "./cli";

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
} from "./schema-builder";
export { SchemaBuilder, TableBuilder, ColumnBuilder } from "./schema-builder";
export type { SqlStatement, Grammar } from "./grammar";
export { SQLiteGrammar, PostgresGrammar } from "./grammar";

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
