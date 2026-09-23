import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class SolaraPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "solara";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("solara_reactions", (table) => {
      table.string("id").primary();
      table.string("postId");
      table.string("actorId");
      table.string("type");
      table.timestamp("createdAt");
      table.index("idx_reactions_post", ["postId"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "solara_reactions" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "solara.v1.001_create_reactions_table";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:solara_reactions",
        ],
      },
    ];
  }
}
