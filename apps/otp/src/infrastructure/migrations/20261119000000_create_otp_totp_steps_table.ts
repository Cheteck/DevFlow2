import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "7c0f92374c9f7519931462486c1bde4ccd4c90468afade7b4956ac8211134afa";
/* checksum:end */

/**
 * @apps/otp — Durable TOTP replay protection.
 *
 * One row per consumed RFC 6238 time step. The composite primary key is what
 * makes `INSERT ... ON CONFLICT DO NOTHING` an atomic "first one wins" gate
 * across instances, replacing the per-process `Map` that `OtpService` used
 * before. `expires_at` (epoch millis) lets `pruneUsedTotpSteps` bound growth.
 */
export const migration: Migration = {
  id: "otp.core.v1.002_create_otp_totp_steps_table",
  checksum: MIGRATION_CHECKSUM,
  up: (context: MigrationContext) => {
    context.schema.createTable("otp_totp_steps", (table) => {
      table.string("tenant_id");
      table.string("user_id");
      table.integer("step");
      table.bigInteger("expires_at");

      table.primary(["tenant_id", "user_id", "step"]);
      table.index("idx_otp_totp_steps_expires_at", ["expires_at"]);
    });
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable("otp_totp_steps");
  },
  resources: ["table:otp_totp_steps"],
};

export default migration;
