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

export function createShellMigrationRegistry(): MigrationRegistry {
  const registry = new MigrationRegistry();
  registry.register(new ShellCoreMigrationProvider());
  registry.register(new ShellThemeMigrationProvider());
  return registry;
}
