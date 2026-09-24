/**
 * @mosaix/core — Theme assignments migration (THEME-06-PG)
 */
import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class ThemeAssignmentsMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "core.theme";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("theme_assignments", (table) => {
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
    // Composite PK via unique index (SchemaBuilder has no composite PK DSL for non-id)
    builder.createIndex("theme_assignments", "uniq_theme_assignments_target", ["target_type", "target_id"], true);

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");
    const downStatements = [{ type: "dropTable" as const, table: "theme_assignments" }].flatMap((bp) =>
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
