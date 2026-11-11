import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "098bc7853a3856ff41e00c200143c36afabc9c7171dd36b21ec7e4ec0e6009a6";
/* checksum:end */

/**
 * beam.messaging.v1.001_create_messaging_tables
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the PostgreSQL grammar and executes the resulting
 * statements. No SQL string is carried by the migration.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */
export const migration: Migration = {
  id: "beam.messaging.v1.001_create_messaging_tables",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["4c92872a8f75efbd"],
  up: (context: MigrationContext) => {
    context.schema.createTable("beam_conversations", (table) => {
      table.string("id").primary();
      table.string("type");
      table.json("participants");
      table.json("data").nullable();
      table.timestamp("createdAt");
      table.index("idx_beam_conv_created", ["createdAt"]);
    });

    context.schema.createTable("beam_messages", (table) => {
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

    context.schema.createTable("beam_notifications", (table) => {
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

    context.schema.createTable("beam_push_subscriptions", (table) => {
      table.string("id").primary();
      table.string("userId");
      table.string("endpoint");
      table.string("p256dh");
      table.string("auth");
      table.timestamp("createdAt");
      table.index("idx_beam_push_user", ["userId"]);
    });
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable("beam_push_subscriptions");
    context.schema.dropTable("beam_notifications");
    context.schema.dropTable("beam_messages");
    context.schema.dropTable("beam_conversations");
  },
  resources: [
    "table:beam_conversations",
    "table:beam_messages",
    "table:beam_notifications",
    "table:beam_push_subscriptions",
  ],
};
