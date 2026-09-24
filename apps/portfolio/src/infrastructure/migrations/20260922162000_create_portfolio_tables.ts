import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

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

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922162000_create_portfolio_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:portfolio_vendables"]
};
