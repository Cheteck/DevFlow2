/**
 * @shell — Aggregated migration registry (Laravel-style `database/migrations`).
 *
 * Single assembly point for every migration provider the shell database
 * needs. The CLI (`mosaix migrate`, `migrate:status`, `migrate:rollback`)
 * and the boot verifier both build from here — one desired state, two
 * consumers. BACs plug in additional providers here until each app owns its
 * migrations outright (see backlog: per-BAC schema ownership).
 */
import { MigrationRegistry } from "@mosaix/migrations";
import { ShellThemeMigrationProvider } from "./theme/theme-migrations.js";
import { ShellCoreMigrationProvider } from "./database/core-migration.js";
import { ShellPostgresPatchProvider } from "./database/postgres-patches.js";

/**
 * Builds the shell registry, optionally with the PostgreSQL-only follow-up
 * patches (`shell.pg.*`). Dialect-gated because the patches use PG-only DDL
 * (`ALTER COLUMN ... TYPE BIGINT`) that SQLite cannot execute. Consumers
 * holding a live adapter pass `db.capabilities.dialect`; dialect-less
 * consumers (tests on `:memory:` SQLite) get the portable subset.
 */
export function createShellMigrationRegistry(
  dialect: "sqlite" | "postgres" = "sqlite",
): MigrationRegistry {
  const registry = new MigrationRegistry();
  registry.register(new ShellCoreMigrationProvider());
  registry.register(new ShellThemeMigrationProvider());
  if (dialect === "postgres") {
    registry.register(new ShellPostgresPatchProvider());
  }
  return registry;
}
