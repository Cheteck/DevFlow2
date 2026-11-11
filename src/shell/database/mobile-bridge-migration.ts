/**
 * @shell/database — Mobile Bridge migration provider.
 *
 * Owns the mobile bridge tables (OAuth PKCE auth codes, device registry,
 * refresh tokens) as versioned migrations executed **only from the CLI**
 * (`mosaix migrate`), tracked in the `mosaix_migrations` ledger.
 */
import {
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const MOBILE_BRIDGE_MIGRATION_ID =
  "shell.mobile.v1.001_create_mobile_bridge_tables";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "8ea8f667263944fafca234659302671147b7096da4fb2cd5e9a47d5cdddc7793";
/* checksum:end */

export class MobileBridgeMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: MOBILE_BRIDGE_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        legacyChecksums: ["f15538e064f8e49d"],
        up: (context: MigrationContext) => {
          context.schema.createTable(
            "oauth_auth_codes",
            (table) => {
              table.text("id").primary();
              table.text("user_id");
              table.text("code_challenge");
              table.text("code_challenge_method").default("S256");
              table.integer("expires_at");
              table.integer("created_at");
            },
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "oauth_auth_codes",
            "idx_oauth_auth_codes_user",
            ["user_id"],
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "oauth_auth_codes",
            "idx_oauth_auth_codes_expires",
            ["expires_at"],
            { ifNotExists: true },
          );

          context.schema.createTable(
            "mobile_devices",
            (table) => {
              table.text("device_id").primary();
              table.text("user_id");
              table.text("fcm_token");
              table.text("platform");
              table.text("app_version").nullable();
              table.text("os_version").nullable();
              table.text("device_model").nullable();
              table.text("subscribed_topics").nullable();
              table.integer("registered_at");
              table.integer("last_active_at");
            },
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "mobile_devices",
            "idx_mobile_devices_user",
            ["user_id"],
            { ifNotExists: true },
          );

          context.schema.createTable(
            "refresh_token_sessions",
            (table) => {
              table.text("session_id").primary();
              table.text("family_id");
              table.text("user_id");
              table.text("device_id");
              table.text("current_refresh_token");
              table.text("previous_refresh_tokens").nullable();
              table.text("scope");
              table.integer("expires_at");
              table.integer("is_revoked").default(0);
              table.integer("created_at");
            },
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "refresh_token_sessions",
            "idx_refresh_token_sessions_user",
            ["user_id"],
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "refresh_token_sessions",
            "idx_refresh_token_sessions_family",
            ["family_id"],
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "refresh_token_sessions",
            "idx_refresh_token_sessions_token",
            ["current_refresh_token"],
            { ifNotExists: true },
          );
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("refresh_token_sessions", {
            ifExists: true,
          });
          context.schema.dropTable("mobile_devices", { ifExists: true });
          context.schema.dropTable("oauth_auth_codes", { ifExists: true });
        },
        resources: [
          "table:oauth_auth_codes",
          "table:mobile_devices",
          "table:refresh_token_sessions",
        ],
      },
    ];
  }
}
