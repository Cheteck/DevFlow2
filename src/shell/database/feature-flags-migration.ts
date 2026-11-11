/**
 * @shell/database — Feature Flags migration provider.
 *
 * Owns the feature_flags table for persistent feature flag storage.
 */
import {
  func,
  type Migration,
  type MigrationContext,
  type MigrationProvider,
} from "@mosaix/migrations";

export const FEATURE_FLAGS_MIGRATION_ID =
  "shell.features.v1.001_create_feature_flags_table";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "4f1e17e276ea4e55c6a8d1cebbe9b894c265508bf2b663b5f4b99d8dfeea63da";
/* checksum:end */

export class FeatureFlagsMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: FEATURE_FLAGS_MIGRATION_ID,
        checksum: MIGRATION_CHECKSUM,
        legacyChecksums: ["030d613a0a2345ce"],
        up: (context: MigrationContext) => {
          context.schema.createTable(
            "feature_flags",
            (table) => {
              table.string("key").primary();
              table.string("value");
              table.string("description").nullable();
              table.string("category").nullable().default("general");
              table.string("variation_type").nullable().default("boolean");
              table.string("roles_allowlist").nullable();
              table.string("users_allowlist").nullable();
              table.string("tenants_allowlist").nullable();
              table.string("plans_allowlist").nullable();
              table.integer("percentage_rollout").nullable();
              table.text("updated_at").default(func("CURRENT_TIMESTAMP"));
            },
            { ifNotExists: true },
          );
          context.schema.createIndex(
            "feature_flags",
            "idx_feature_flags_category",
            ["category"],
            { ifNotExists: true },
          );
        },
        downMigration: (context: MigrationContext) => {
          context.schema.dropTable("feature_flags", { ifExists: true });
        },
        resources: ["table:feature_flags"],
      },
    ];
  }
}
