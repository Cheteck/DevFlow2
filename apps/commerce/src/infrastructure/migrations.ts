import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class CommercePostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "commerce";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("commerce_orders", (table) => {
      table.string("id").primary();
      table.string("customerId");
      table.json("items");
      table.decimal("totalAmount");
      table.string("status");
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "commerce_orders" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "commerce.v1.001_create_commerce_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:commerce_orders",
        ],
      },
    ];
  }
}
