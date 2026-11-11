import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "787ab6f8d27773a1c90e7c06353069caf4dd14a6219f197c59a2488f56cc1715";
/* checksum:end */

/**
 * shell.core.v1.002_create_subscription_tables
 *
 * Subscription persistence was previously ensured ad-hoc by the
 * SubscriptionService constructor (removed per CONF-DB-001). The Postgres
 * provider (apps/subscription) owns this schema long-term; this SQLite table
 * keeps the shell runtime working until per-BAC ownership lands (backlog
 * DB-BAC-OWNERSHIP).
 */

export const migration: Migration = {
  id: "shell.core.v1.002_create_subscription_tables",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["2f1efbd51654069f"],
  up: (context: MigrationContext) => {
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
    context.schema.dropTable("user_subscriptions", { ifExists: true });
  },
  resources: ["table:user_subscriptions"],
};
