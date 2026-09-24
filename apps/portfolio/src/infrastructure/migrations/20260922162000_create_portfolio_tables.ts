import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

// 1. Portfolio Vendables
builder.createTable("portfolio_vendables", (table) => {
  table.string("id").primary();
  table.string("reference");
  table.enum("type", ["Product", "Service", "DigitalProduct", "Experience"]);
  table.enum("status", ["Draft", "In Review", "Published", "Archived"]);
  table.json("content");
  table.json("characteristics");
  table.json("classification");
  table.json("media");
  table.json("variants");
  table.json("relations");
  table.json("quality").nullable();
  table.timestamp("createdAt");
  table.timestamp("updatedAt");
  table.unique("uniq_vendable_reference", ["reference"]);
  table.index("idx_vendable_type_status", ["type", "status"]);
});

// 2. Portfolio Categories
builder.createTable("portfolio_categories", (table) => {
  table.string("id").primary();
  table.string("slug");
  table.string("name");
  table.string("parentId").nullable();
  table.timestamp("createdAt");
  table.unique("uniq_portfolio_cat_slug", ["slug"]);
  table.index("idx_portfolio_cat_parent", ["parentId"]);
});

// 3. Portfolio Variants
builder.createTable("portfolio_variants", (table) => {
  table.string("id").primary();
  table.string("vendableId");
  table.string("sku");
  table.string("name");
  table.integer("priceInCents");
  table.integer("stock").default(0);
  table.timestamp("createdAt");
  table.foreignKey("vendableId", "portfolio_vendables", "id");
  table.unique("uniq_portfolio_variant_sku", ["sku"]);
  table.index("idx_portfolio_variant_vendable", ["vendableId"]);
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922162000_create_portfolio_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: [
    "table:portfolio_vendables",
    "table:portfolio_categories",
    "table:portfolio_variants",
  ]
};
