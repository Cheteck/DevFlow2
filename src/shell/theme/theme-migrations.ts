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
  SchemaBuilder,
  SQLiteGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export const SHELL_THEME_MIGRATION_ID =
  "shell.theme.v1.001_create_theme_assignments";

function buildUpContent(): string {
  const builder = new SchemaBuilder();
  builder.createTable("theme_assignments", (table) => {
    table.string("id").primary();
    table.string("target_type");
    table.string("target_id");
    table.string("theme_id");
    table.string("mode").nullable();
    table.string("source");
    table.timestamp("updated_at");
    table.unique("uq_theme_assignments_target", ["target_type", "target_id"]);
  });
  const grammar = new SQLiteGrammar();
  return builder.blueprints
    .flatMap((bp) => grammar.compile(bp))
    .map((s) => s.sql)
    .join("\n");
}

function buildDownContent(): string {
  const grammar = new SQLiteGrammar();
  return [{ type: "dropTable" as const, table: "theme_assignments" }]
    .flatMap((bp) => grammar.compile(bp))
    .map((s) => s.sql)
    .join("\n");
}

export class ShellThemeMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    const content = buildUpContent();
    const down = buildDownContent();
    return [
      {
        id: SHELL_THEME_MIGRATION_ID,
        content,
        down,
        checksum: computeChecksum(content),
        resources: [
          "table:theme_assignments",
          "index:uq_theme_assignments_target",
        ],
      },
    ];
  }
}
