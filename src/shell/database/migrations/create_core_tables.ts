import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "81afc367da681ca28fc35fa205ccd4d8a020f70c37fa02111510cf5f97692a18";
/* checksum:end */

/**
 * shell.core.v1.001_create_core_tables
 *
 * Owns the shell-level tables (identities/auth, feed, commerce, portfolio,
 * spaces, beam, booking, imperia, solidarity, platform settings) as a
 * versioned migration executed **only from the CLI** (`mosaix migrate`),
 * tracked in the `mosaix_migrations` ledger — never as ad-hoc DDL at boot.
 *
 * Per-BAC ownership (each app owning its tables) is the documented next step.
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the grammar of the target dialect and executes the resulting
 * statements. No SQL string is carried by the migration.
 *
 * The historical checksum is kept in `legacyChecksums` so that databases
 * where this migration is already applied are not rejected by the Planner.
 */

export const migration: Migration = {
  id: "shell.core.v1.001_create_core_tables",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["4d4e5c6c51ecb86b"],
  up: (context: MigrationContext) => {
    context.schema.createTable(
      "identities",
      (table) => {
        table.text("id").primary();
        table.text("tenant_id").nullable().default("default");
        table.text("email").nullable().uniqueInline();
        table.text("display_name").nullable();
        table.text("status").nullable().default("active");
        table.text("password_hash").nullable();
        table.text("roles").nullable().default('["member"]');
        table.text("created_at");
        table.text("updated_at").nullable();
        table.text("attributes").nullable();
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "external_identities",
      (table) => {
        table.text("identity_id");
        table.text("provider");
        table.text("external_id");
        table.text("linked_at");
        table.text("attributes").nullable();
        table.primary(["identity_id", "provider", "external_id"]);
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "credentials",
      (table) => {
        table.text("id").primary();
        table.text("identity_id");
        table.text("type");
        table.text("created_at");
        table.text("updated_at").nullable();
        table.text("expires_at").nullable();
        table.text("revoked_at").nullable();
        table.text("data").nullable();
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "sessions",
      (table) => {
        table.text("id").primary();
        table.text("identity_id");
        table.text("tenant_id").nullable().default("default");
        table.text("application_id").nullable();
        table.text("created_at");
        table.text("expires_at");
        table.text("revoked_at").nullable();
        table.text("attributes").nullable();
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "tokens",
      (table) => {
        table.text("token_id").primary();
        table.text("identity_id");
        table.text("session_id").nullable();
        table.text("type");
        table.text("expires_at");
        table.text("revoked_at").nullable();
        table.text("attributes").nullable();
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "shell_feed",
      (table) => {
        table.text("id").primary();
        table.text("type").default("post");
        table.text("author");
        table.text("title").nullable();
        table.text("content");
        table.text("category").nullable().default("general");
        table.text("tags").nullable();
        table.integer("likes").nullable().default(0);
        table.integer("timestamp");
        table.text("space_id").nullable();
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "commerce_products",
      (table) => {
        table.text("id").primary();
        table.text("title");
        table.text("description").nullable();
        table.real("price");
        table.text("currency").default("EUR");
        table.text("category").default("digital");
        table.integer("stock").default(100);
        table.text("image_url").nullable();
        table.text("status").default("active");
        table.text("created_at");
        table.text("updated_at").nullable();
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "commerce_orders",
      (table) => {
        table.text("id").primary();
        table.text("user_id");
        table.text("items");
        table.real("total_amount");
        table.text("currency").default("EUR");
        table.text("status").default("pending");
        table.text("shipping_address").nullable();
        table.text("created_at");
        table.text("updated_at").nullable();
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "commerce_cart_items",
      (table) => {
        table.text("id").primary();
        table.text("user_id");
        table.text("product_id");
        table.integer("quantity").default(1);
        table.text("added_at");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "portfolio_items",
      (table) => {
        table.text("id").primary();
        table.text("title");
        table.text("description").nullable();
        table.text("creator_id");
        table.text("image_url").nullable();
        table.text("category").default("design");
        table.text("tags").nullable();
        table.real("price").nullable();
        table.text("status").default("published");
        table.text("created_at");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "spaces",
      (table) => {
        table.text("id").primary();
        table.text("name");
        table.text("description").nullable();
        table.text("owner_role");
        table.text("badge");
        table.text("avatar");
        table.integer("members_count").default(1);
        table.integer("is_private").default(0);
        table.text("created_at");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "space_members",
      (table) => {
        table.text("space_id");
        table.text("user_id");
        table.text("role").default("member");
        table.text("joined_at");
        table.primary(["space_id", "user_id"]);
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "beam_channels",
      (table) => {
        table.text("id").primary();
        table.text("name");
        table.text("description").nullable();
        table.text("icon").nullable().default("💬");
        table.integer("is_private").default(0);
        table.text("created_at");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "beam_messages",
      (table) => {
        table.text("id").primary();
        table.text("channel_id");
        table.text("sender_id");
        table.text("sender_name");
        table.text("sender_avatar").nullable().default("👤");
        table.text("content");
        table.text("attachments").nullable();
        table.integer("timestamp");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "booking_slots",
      (table) => {
        table.text("id").primary();
        table.text("title");
        table.text("host_id");
        table.text("start_time");
        table.text("end_time");
        table.integer("capacity").default(1);
        table.integer("booked_count").default(0);
        table.text("status").default("available");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "booking_reservations",
      (table) => {
        table.text("id").primary();
        table.text("slot_id");
        table.text("user_id");
        table.text("user_name");
        table.text("user_email");
        table.text("status").default("confirmed");
        table.text("notes").nullable();
        table.text("created_at");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "imperia_proposals",
      (table) => {
        table.text("id").primary();
        table.text("title");
        table.text("summary");
        table.text("author");
        table.text("status").default("active");
        table.text("category").default("governance");
        table.integer("votes_for").default(0);
        table.integer("votes_against").default(0);
        table.integer("votes_abstain").default(0);
        table.text("ends_at");
        table.text("created_at");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "imperia_votes",
      (table) => {
        table.text("id").primary();
        table.text("proposal_id");
        table.text("user_id");
        table.text("choice");
        table.real("weight").default(1.0);
        table.text("cast_at");
        table.uniqueColumns(["proposal_id", "user_id"]);
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "solidarity_campaigns",
      (table) => {
        table.text("id").primary();
        table.text("title");
        table.text("description");
        table.real("goal_amount");
        table.real("raised_amount").default(0);
        table.text("currency").default("EUR");
        table.text("beneficiary");
        table.text("status").default("active");
        table.text("created_at");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "solidarity_contributions",
      (table) => {
        table.text("id").primary();
        table.text("campaign_id");
        table.text("user_id");
        table.real("amount");
        table.text("currency").default("EUR");
        table.text("message").nullable();
        table.integer("timestamp");
      },
      { ifNotExists: true },
    );
    context.schema.createTable(
      "platform_settings",
      (table) => {
        table.text("key").primary();
        table.text("value");
        table.text("updated_at");
      },
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "identities",
      "idx_identities_email",
      [{ name: "email" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "identities",
      "idx_identities_tenant",
      [{ name: "tenant_id" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "shell_feed",
      "idx_shell_feed_timestamp",
      [{ name: "timestamp", direction: "desc" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "shell_feed",
      "idx_shell_feed_category",
      [{ name: "category" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "commerce_products",
      "idx_commerce_products_cat",
      [{ name: "category" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "portfolio_items",
      "idx_portfolio_creator",
      [{ name: "creator_id" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "beam_messages",
      "idx_beam_messages_channel",
      [{ name: "channel_id" }, { name: "timestamp" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "booking_slots",
      "idx_booking_slots_time",
      [{ name: "start_time" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "imperia_proposals",
      "idx_imperia_proposals_status",
      [{ name: "status" }],
      { ifNotExists: true },
    );
    context.schema.createIndex(
      "solidarity_campaigns",
      "idx_solidarity_campaigns_status",
      [{ name: "status" }],
      { ifNotExists: true },
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable("solidarity_contributions", { ifExists: true });
    context.schema.dropTable("solidarity_campaigns", { ifExists: true });
    context.schema.dropTable("imperia_votes", { ifExists: true });
    context.schema.dropTable("imperia_proposals", { ifExists: true });
    context.schema.dropTable("booking_reservations", { ifExists: true });
    context.schema.dropTable("booking_slots", { ifExists: true });
    context.schema.dropTable("beam_messages", { ifExists: true });
    context.schema.dropTable("beam_channels", { ifExists: true });
    context.schema.dropTable("space_members", { ifExists: true });
    context.schema.dropTable("spaces", { ifExists: true });
    context.schema.dropTable("portfolio_items", { ifExists: true });
    context.schema.dropTable("commerce_cart_items", { ifExists: true });
    context.schema.dropTable("commerce_orders", { ifExists: true });
    context.schema.dropTable("commerce_products", { ifExists: true });
    context.schema.dropTable("shell_feed", { ifExists: true });
    context.schema.dropTable("tokens", { ifExists: true });
    context.schema.dropTable("sessions", { ifExists: true });
    context.schema.dropTable("credentials", { ifExists: true });
    context.schema.dropTable("external_identities", { ifExists: true });
    context.schema.dropTable("identities", { ifExists: true });
    context.schema.dropTable("platform_settings", { ifExists: true });
  },
  resources: [
    "table:identities",
    "table:external_identities",
    "table:credentials",
    "table:sessions",
    "table:tokens",
    "table:shell_feed",
    "table:commerce_products",
    "table:commerce_orders",
    "table:commerce_cart_items",
    "table:portfolio_items",
    "table:spaces",
    "table:space_members",
    "table:beam_channels",
    "table:beam_messages",
    "table:booking_slots",
    "table:booking_reservations",
    "table:imperia_proposals",
    "table:imperia_votes",
    "table:solidarity_campaigns",
    "table:solidarity_contributions",
    "table:platform_settings",
  ],
};
