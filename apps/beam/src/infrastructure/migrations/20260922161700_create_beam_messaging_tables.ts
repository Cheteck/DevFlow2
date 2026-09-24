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
  table.string("replyToMessageId").nullable();
  table.string("threadId").nullable();
  table.json("reactions").nullable();
  table.json("attachments").nullable();
  table.json("encryptedPayload").nullable();
  table.timestamp("editedAt").nullable();
  table.timestamp("deletedAt").nullable();
  table.timestamp("sentAt");
  table.foreignKey("conversationId", "beam_conversations", "id");
  table.index("idx_beam_messages_conv_sent", ["conversationId", "sentAt"]);
  table.index("idx_beam_messages_sender", ["senderId"]);
  table.index("idx_beam_messages_thread", ["threadId"]);
});

builder.createTable("beam_notifications", (table) => {
  table.string("id").primary();
  table.string("userId");
  table.string("title");
  table.string("body");
  table.string("type");
  table.boolean("isRead").default(false);
  table.json("data").nullable();
  table.timestamp("createdAt");
  table.index("idx_beam_notifications_user", ["userId"]);
});

builder.createTable("beam_push_subscriptions", (table) => {
  table.string("id").primary();
  table.string("userId");
  table.string("endpoint");
  table.string("p256dh");
  table.string("auth");
  table.timestamp("createdAt");
  table.index("idx_beam_push_user", ["userId"]);
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922161700_create_beam_messaging_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: [
    "table:beam_conversations",
    "table:beam_messages",
    "table:beam_notifications",
    "table:beam_push_subscriptions",
  ]
};
