/**
 * @shell/database — Minimal core migration provider for fresh Postgres DB.
 * Only creates tables that are truly shell-owned (not claimed by any BAC).
 * Used temporarily until DB-BAC-OWNERSHIP moves tables out of shell.core.v1.001.
 */
import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const MINIMAL_CORE_MIGRATION_ID =
  "shell.core.v1.003_minimal_core_tables";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "904f5ddd4e41dc730c59be8545218d467f7ba97f3fe17f8d82fc91f29a1cc129";
/* checksum:end */

export class MinimalCoreMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: MINIMAL_CORE_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        legacyChecksums: ["cf891ceac05a0d4d"],
        up: (context: MigrationContext) => {
          // Shell-owned tables only (not claimed by BACs).
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
            "user_subscriptions",
            (table) => {
              table.text("id").primary();
              table.text("user_id");
              table.text("plan_id").nullable();
              table.text("status").nullable();
              table.integer("current_period_start").nullable();
              table.integer("current_period_end").nullable();
              table.integer("cancel_at_period_end").nullable();
              table.integer("metered_usage_units").nullable();
              table.integer("created_at").nullable();
              table.integer("updated_at").nullable();
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
            ["email"],
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "identities",
            "idx_identities_tenant",
            ["tenant_id"],
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
            ["category"],
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "user_subscriptions",
            "idx_user_subscriptions_user",
            ["user_id"],
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "user_subscriptions",
            "idx_user_subscriptions_status",
            ["status"],
            { ifNotExists: true },
          );
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("platform_settings", { ifExists: true });
          context.schema.dropTable("shell_feed", { ifExists: true });
          context.schema.dropTable("user_subscriptions", { ifExists: true });
          context.schema.dropTable("tokens", { ifExists: true });
          context.schema.dropTable("sessions", { ifExists: true });
          context.schema.dropTable("credentials", { ifExists: true });
          context.schema.dropTable("external_identities", { ifExists: true });
          context.schema.dropTable("identities", { ifExists: true });
        },
        resources: [
          "table:identities",
          "table:external_identities",
          "table:credentials",
          "table:sessions",
          "table:tokens",
          "table:user_subscriptions",
          "table:shell_feed",
          "table:platform_settings",
        ],
      },
    ];
  }
}
