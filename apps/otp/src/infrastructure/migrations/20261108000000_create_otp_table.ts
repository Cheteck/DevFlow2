import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "381a7057c19d68721b2cfe5a5d3e7e249fba97aee016860433bc1065c00cb761";
/* checksum:end */

/**
 * @apps/otp — Create otp table (SchemaBuilder DSL, TypeScript).
 *
 * Builds the schema programmatically via `@mosaix/migrations` SchemaBuilder
 * instead of hand-written SQL strings, so the same blueprint compiles for
 * both Postgres and SQLite grammars. The engine compiles it with the
 * grammar of the adapter in use: the two historical variants (Postgres and
 * SQLite) are therefore a single migration.
 */
export const migration: Migration = {
  id: "otp.core.v1.001_create_otp_table",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["6866e28f4279e507"],
  up: (context: MigrationContext) => {
    context.schema.createTable("otp", (table) => {
      table.string("id").primary();
      table.string("tenant_id");
      table.string("destination");
      table.string("channel");
      table.string("purpose");
      table.string("user_id").nullable();
      table.string("code_hash");
      table.integer("created_at");
      table.integer("expires_at");
      table.integer("consumed_at").nullable();
      table.integer("attempts").default(0);
      table.integer("max_attempts").default(5);

      table.index("idx_otp_tenant_destination_purpose_user", [
        "tenant_id",
        "destination",
        "purpose",
        "user_id",
      ]);
    });
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable("otp");
  },
  resources: ["table:otp"],
};

export default migration;
