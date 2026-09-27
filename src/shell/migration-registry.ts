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
import { MinimalCoreMigrationProvider } from "./database/minimal-core-migration.js";
import { MobileBridgeMigrationProvider } from "./database/mobile-bridge-migration.js";
import { FeatureFlagsMigrationProvider } from "./database/feature-flags-migration.js";
import { registerBacMigrations } from "./bac-migrations.js";

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
  if (dialect === "postgres") {
    // Fresh Postgres DB: use minimal core (only truly shell-owned tables)
    // to avoid resource collisions with BAC migrations (DB-BAC-OWNERSHIP).
    // Skip ShellPostgresPatchProvider — it targets tables from shell.core.v1.002
    // (user_subscriptions) and shell.core.v1.001 (beam_messages, solidarity_contributions)
    // which are now owned by BACs or not created by minimal core.
    registry.register(new MinimalCoreMigrationProvider());
    registry.register(new ShellThemeMigrationProvider());
    registry.register(new MobileBridgeMigrationProvider());
    registry.register(new FeatureFlagsMigrationProvider());
    registerBacMigrations(registry);
  } else {
    // SQLite (tests, local dev): keep full shell core for compatibility.
    registry.register(new ShellCoreMigrationProvider());
    registry.register(new ShellThemeMigrationProvider());
    registry.register(new MobileBridgeMigrationProvider());
    registry.register(new FeatureFlagsMigrationProvider());
  }
  return registry;
}
