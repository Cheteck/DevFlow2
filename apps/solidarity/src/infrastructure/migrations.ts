import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class SolidarityPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "solidarity";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("solidarity_needs", (table) => {
      table.string("id").primary();
      table.string("requesterId");
      table.string("type");
      table.string("description");
      table.string("status");
      table.timestamp("createdAt");
    });

    builder.createTable("solidarity_offers", (table) => {
      table.string("id").primary();
      table.string("providerId");
      table.string("needId");
      table.string("status");
      table.timestamp("createdAt");
      table.foreignKey("needId", "solidarity_needs", "id");
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "solidarity_offers" },
      { type: "dropTable" as const, table: "solidarity_needs" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "solidarity.v1.001_create_solidarity_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:solidarity_needs",
          "table:solidarity_offers",
        ],
      },
    ];
  }
}
