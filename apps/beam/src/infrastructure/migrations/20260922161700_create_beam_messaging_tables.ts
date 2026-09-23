import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

builder.createTable("beam_conversations", (table) => {
  table.string("id").primary();
  table.string("type");
  table.json("metadata").nullable();
  table.timestamp("created_at");
});

builder.createTable("beam_messages", (table) => {
  table.string("id").primary();
  table.string("conversation_id");
  table.string("sender_id");
  table.string("content");
  table.boolean("is_read").default(false);
  table.timestamp("created_at");
  table.foreignKey("conversation_id", "beam_conversations", "id");
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922161700_create_beam_messaging_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:beam_conversations", "table:beam_messages"]
};
