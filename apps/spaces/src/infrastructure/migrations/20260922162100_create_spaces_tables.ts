import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

builder.createTable("spaces", (table) => {
  table.string("id").primary();
  table.string("name");
  table.string("slug").unique("uniq_space_slug", ["slug"]);
  table.string("owner_id");
  table.timestamp("created_at");
});

builder.createTable("space_members", (table) => {
  table.string("id").primary();
  table.string("space_id");
  table.string("user_id");
  table.string("role");
  table.foreignKey("space_id", "spaces", "id");
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922162100_create_spaces_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:spaces", "table:space_members"]
};
