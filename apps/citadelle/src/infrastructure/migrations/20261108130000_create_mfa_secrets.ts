import {
  func,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "cee92d1e16b1ef22598313248316600feb1d7aab4ff480c0638df28eb5fdd22a";
/* checksum:end */

/**
 * @apps/citadelle — Create mfa_secrets table for MFA state persistence
 *
 * Creates the public.mfa_secrets table to persist multi-factor authentication
 * state per user. This migration is applied via the shell migration registry
 * and is owned by the citadelle BAC.
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the PostgreSQL grammar and executes the resulting
 * statements. No SQL string is carried by the migration.
 *
 * This migration has no historical rollback: it is irreversible. Declaring a
 * `downMigration` would make the Planner believe it can revert the tables,
 * which the original SQL migration never could.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */

export const migration: Migration = {
  id: "citadelle.mfa.v1.002_create_mfa_secrets",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["b944d6bbce9f7241"],
  resources: ["table:mfa_secrets", "table:mfa_used_totp_steps"],
  up: (context: MigrationContext) => {
    context.schema.createTable(
      "mfa_secrets",
      (table) => {
        table.text("user_id").primary();
        table.text("tenant_id");
        table.text("encrypted_secret");
        table.text("encryption_iv");
        table.text("encryption_tag");
        table.boolean("enabled").default(false);
        table.timestampWithoutTimeZone("enrolled_at").nullable();
        table.timestampWithoutTimeZone("last_verified_at").nullable();
        table.text("recovery_codes").default("[]");
        table.integer("failed_attempts").default(0);
        table.timestampWithoutTimeZone("lock_until").nullable();
        table.text("key_version").default("v1");
      },
      { ifNotExists: true, schema: "public" },
    );
    context.schema.createIndex(
      { schema: "public", name: "mfa_secrets" },
      "idx_mfa_secrets_tenant_user",
      [{ name: "tenant_id" }, { name: "user_id" }],
      { unique: true, ifNotExists: true },
    );
    context.schema.createTable(
      "mfa_used_totp_steps",
      (table) => {
        table.text("tenant_id");
        table.text("user_id");
        table.integer("totp_step");
        table.timestampWithoutTimeZone("used_at").default(func("now"));
        table.primary(["tenant_id", "user_id", "totp_step"]);
      },
      { ifNotExists: true, schema: "public" },
    );
  },
};
