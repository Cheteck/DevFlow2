import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

// Normalisation Commerce
builder.createTable("commerce_order_items", (table) => {
  table.string("id").primary();
  table.string("order_id");
  table.string("product_id");
  table.integer("quantity");
  table.decimal("price");
  table.foreignKey("order_id", "commerce_orders", "id");
  table.index("idx_order_items_order_id", ["order_id"]);
  table.index("idx_order_items_product_id", ["product_id"]);
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922161600_normalize_commerce_orders",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:commerce_order_items"]
};
