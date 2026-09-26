/**
 * @shell/database — PostgreSQL-only follow-up patches for shell tables.
 *
 * Epoch-millisecond columns are `INTEGER` in the shared `shell.core`
 * migrations (64-bit on SQLite, fine) but 32-bit `INTEGER` overflows on
 * PostgreSQL (`value ... is out of range for type integer`). This provider
 * widens them to `BIGINT` — Postgres only, never registered on SQLite.
 *
 * Wired by dialect in `createShellMigrationRegistry()`; the boot verifier
 * and the CLI both resolve the registry from the live adapter dialect.
 */
import {
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export const SHELL_PG_PATCH_MIGRATION_ID = "shell.pg.v1.001_bigint_epoch_columns";

const UP = `
ALTER TABLE shell_feed ALTER COLUMN timestamp TYPE BIGINT;
ALTER TABLE beam_messages ALTER COLUMN timestamp TYPE BIGINT;
ALTER TABLE solidarity_contributions ALTER COLUMN timestamp TYPE BIGINT;
ALTER TABLE user_subscriptions ALTER COLUMN current_period_start TYPE BIGINT;
ALTER TABLE user_subscriptions ALTER COLUMN current_period_end TYPE BIGINT;
ALTER TABLE user_subscriptions ALTER COLUMN cancel_at_period_end TYPE BIGINT;
ALTER TABLE user_subscriptions ALTER COLUMN metered_usage_units TYPE BIGINT;
ALTER TABLE user_subscriptions ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE user_subscriptions ALTER COLUMN updated_at TYPE BIGINT;
`;

const DOWN = `
ALTER TABLE shell_feed ALTER COLUMN timestamp TYPE INTEGER;
ALTER TABLE beam_messages ALTER COLUMN timestamp TYPE INTEGER;
ALTER TABLE solidarity_contributions ALTER COLUMN timestamp TYPE INTEGER;
ALTER TABLE user_subscriptions ALTER COLUMN current_period_start TYPE INTEGER;
ALTER TABLE user_subscriptions ALTER COLUMN current_period_end TYPE INTEGER;
ALTER TABLE user_subscriptions ALTER COLUMN cancel_at_period_end TYPE INTEGER;
ALTER TABLE user_subscriptions ALTER COLUMN metered_usage_units TYPE INTEGER;
ALTER TABLE user_subscriptions ALTER COLUMN created_at TYPE INTEGER;
ALTER TABLE user_subscriptions ALTER COLUMN updated_at TYPE INTEGER;
`;

export class ShellPostgresPatchProvider implements MigrationProvider {
  ownerId(): string {
    return "shell.pg";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: SHELL_PG_PATCH_MIGRATION_ID,
        content: UP,
        down: DOWN,
        checksum: computeChecksum(UP),
        resources: [
          "column:shell_feed.timestamp",
          "column:beam_messages.timestamp",
          "column:solidarity_contributions.timestamp",
          "column:user_subscriptions.current_period_start",
          "column:user_subscriptions.current_period_end",
          "column:user_subscriptions.cancel_at_period_end",
          "column:user_subscriptions.metered_usage_units",
          "column:user_subscriptions.created_at",
          "column:user_subscriptions.updated_at",
        ],
      },
    ];
  }
}
