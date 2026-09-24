import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

builder.createTable("beam_conversations", (table) => {
  table.string("id").primary();
  table.string("type");
  table.json("participants");
  table.json("data").nullable();
  table.timestamp("createdAt");
  table.index("idx_beam_conv_created", ["createdAt"]);
});

builder.createTable("beam_messages", (table) => {
  table.string("id").primary();
  table.string("conversationId");
  table.string("senderId");
  table.string("content");
  table.timestamp("sentAt");
  table.foreignKey("conversationId", "beam_conversations", "id");
  table.index("idx_beam_messages_conv_sent", ["conversationId", "sentAt"]);
  table.index("idx_beam_messages_sender", ["senderId"]);
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922161700_create_beam_messaging_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:beam_conversations", "table:beam_messages"]
};
