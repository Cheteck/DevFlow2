/**
 * @mosaix/theme — Theme assignments migration
 */
import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Blueprint,
  type Migration,
  type MigrationProvider,
  type SqlStatement,
  type TableBuilder,
} from "@mosaix/migrations";

export class ThemeAssignmentsMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "core.theme";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("theme_assignments", (table: TableBuilder) => {
      table.string("target_type");
      table.string("target_id");
      table.string("theme_id");
      table.string("mode").default("system");
      table.string("version").nullable();
      table.string("source").default("platform");
      table.timestamp("updated_at");
      table.string("updated_by").nullable();
      table.index("idx_theme_assignments_target", ["target_type", "target_id"]);
      table.index("idx_theme_assignments_theme", ["theme_id"]);
    });
    builder.createIndex("theme_assignments", "uniq_theme_assignments_target", ["target_type", "target_id"], true);

    const statements: readonly SqlStatement[] = builder.blueprints.flatMap((bp: Blueprint) =>
      grammar.compile(bp),
    );
    const sqlContent = statements.map((s) => s.sql).join("\n");
    const downStatements = [{ type: "dropTable" as const, table: "theme_assignments" }].flatMap((bp: Blueprint) =>
      grammar.compile(bp),
    );
    return [
      {
        id: "core.theme.v1.001_create_theme_assignments",
        content: sqlContent,
        down: downStatements.map((s) => s.sql).join("\n"),
        checksum: computeChecksum(sqlContent),
        resources: ["table:theme_assignments"],
      },
    ];
  }
}
