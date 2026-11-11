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
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const SHELL_PG_PATCH_MIGRATION_ID =
  "shell.pg.v1.001_bigint_epoch_columns";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "410620bbbe2979b69b08766ae4e24d1da42c56eb51f9e2ec3412599145501b4b";
/* checksum:end */

/** The columns widened to `BIGINT`, in declaration order. */
const EPOCH_COLUMNS: readonly {
  readonly table: string;
  readonly column: string;
}[] = [
  { table: "shell_feed", column: "timestamp" },
  { table: "beam_messages", column: "timestamp" },
  { table: "solidarity_contributions", column: "timestamp" },
  { table: "user_subscriptions", column: "current_period_start" },
  { table: "user_subscriptions", column: "current_period_end" },
  { table: "user_subscriptions", column: "cancel_at_period_end" },
  { table: "user_subscriptions", column: "metered_usage_units" },
  { table: "user_subscriptions", column: "created_at" },
  { table: "user_subscriptions", column: "updated_at" },
];

export class ShellPostgresPatchProvider implements MigrationProvider {
  ownerId(): string {
    return "shell.pg";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: SHELL_PG_PATCH_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        up: (context: MigrationContext) => {
          // `alterColumnType` is the SchemaBuilder blueprint of
          // `ALTER TABLE ... ALTER COLUMN ... TYPE ...` — PostgreSQL only
          // (the SQLite grammar refuses it explicitly).
          for (const { table, column } of EPOCH_COLUMNS) {
            context.schema.alterColumnType(
              { name: table },
              column,
              "bigInteger",
            );
          }
        },
        downMigration: (context: MigrationContext) => {
          for (const { table, column } of EPOCH_COLUMNS) {
            context.schema.alterColumnType({ name: table }, column, "integer");
          }
        },
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
