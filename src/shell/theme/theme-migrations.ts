/**
 * @shell/theme — Shell theme migration provider (production practice).
 *
 * Theme storage goes through the MosaiX migration engine
 * (`@mosaix/migrations`: Registry → Planner → Runner), never through ad-hoc
 * DDL. Owner `shell`, module `theme`, SQLite grammar (the shell runs on the
 * local SQLite adapter; Postgres app providers live next to their apps).
 *
 * Executed from the CLI by `mosaix migrate` (see `src/shell/migrations.ts`
 * `runShellMigrations()`), verified (never applied) at boot. State is tracked
 * in the `mosaix_migrations` ledger, so this is idempotent across restarts.
 */
import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const SHELL_THEME_MIGRATION_ID =
  "shell.theme.v1.001_create_theme_assignments";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "a11185bad139ad9ec9160a5558edee9c8e6d336aebd8971d0da7c1c4a3afde7f";
/* checksum:end */

export class ShellThemeMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: SHELL_THEME_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        legacyChecksums: ["65acffe0d12fb35b"],
        up: (context: MigrationContext) => {
          context.schema.createTable("theme_assignments", (table) => {
            table.string("id").primary();
            table.string("target_type");
            table.string("target_id");
            table.string("theme_id");
            table.string("mode").nullable();
            table.string("source");
            table.timestamp("updated_at");
            table.unique("uq_theme_assignments_target", [
              "target_type",
              "target_id",
            ]);
          });
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("theme_assignments");
        },
        resources: [
          "table:theme_assignments",
          "index:uq_theme_assignments_target",
        ],
      },
    ];
  }
}
