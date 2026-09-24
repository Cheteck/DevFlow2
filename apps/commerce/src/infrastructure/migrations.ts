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
      table.string("userId");
      table.string("vendableId").nullable();
      table.string("customerId").nullable();
      table.enum("status", [
        "Pending",
        "Paid",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
        "Refunded",
      ]);
      table.string("currency").default("EUR");
      table.decimal("totalAmount").default(0);
      table.decimal("taxAmount").default(0);
      table.string("discountCode").nullable();
      table.json("shippingAddress").nullable();
      table.json("billingAddress").nullable();
      table.json("lineItems").nullable();
      table.json("items").nullable();
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.timestamp("deletedAt").nullable();
      table.index("idx_orders_user", ["userId"]);
      table.index("idx_orders_status", ["status"]);
      table.index("idx_orders_vendable", ["vendableId"]);
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
