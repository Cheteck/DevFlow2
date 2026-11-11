/**
 * @shell/database — Shell core migration provider (Laravel-style `database/migrations`).
 *
 * Owns the shell-level tables as versioned migrations executed **only from
 * the CLI** (`mosaix migrate`), tracked in the `mosaix_migrations` ledger —
 * never as ad-hoc DDL at boot.
 *
 * The migrations themselves live in `./migrations/` (one module per
 * migration, each carrying its canonical identity and its resources). This
 * provider is the manifest that registers them.
 *
 * Per-BAC ownership (each app owning its tables) is the documented next step.
 */
import type { Migration, MigrationProvider } from "@mosaix/migrations";
import { migration as createCoreTables } from "./migrations/create_core_tables.js";
import { migration as createSubscriptionTables } from "./migrations/create_subscription_tables.js";

export const SHELL_CORE_MIGRATION_ID = "shell.core.v1.001_create_core_tables";
export const SHELL_SUBSCRIPTION_MIGRATION_ID =
  "shell.core.v1.002_create_subscription_tables";

export class ShellCoreMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [createCoreTables, createSubscriptionTables];
  }
}
