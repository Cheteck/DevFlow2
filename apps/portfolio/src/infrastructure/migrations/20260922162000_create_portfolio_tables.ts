import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

builder.createTable("portfolio_vendables", (table) => {
  table.string("id").primary();
  table.string("owner_id");
  table.string("type");
  table.string("title");
  table.decimal("price");
  table.timestamp("created_at");
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922162000_create_portfolio_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:portfolio_vendables"]
};
