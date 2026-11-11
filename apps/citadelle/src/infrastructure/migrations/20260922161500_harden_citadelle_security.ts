import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "140ede4a9dfec39221042333577993faf0759f589ebccb60f8ac633442ccc652";
/* checksum:end */

/**
 * citadelle.auth.v1.002 — harden the Citadelle security columns.
 *
 * Adds the security columns of the legacy `citadelle_*` tables (last login,
 * MFA flag, IP address, user agent).
 *
 * ORPHAN MIGRATION — deliberately not registered in the shell registry
 * (`src/shell/bac-migrations.ts`): the `citadelle_*` prefixed tables are no
 * longer created (ownership transferred to the shell, see
 * `citadelle.auth.v1.001_create_auth_tables`). The migration is kept as a
 * TypeScript native module for the citadelle wave (DB-BAC-OWNERSHIP).
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */
export const migration: Migration = {
  id: "citadelle.auth.v1.002_harden_security",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["416e03f5fed43e27"],
  up: (context: MigrationContext) => {
    context.schema.addColumn(
      "citadelle_identities",
      "last_login_at",
      "timestamp",
      (col) => col.nullable(),
    );
    context.schema.addColumn(
      "citadelle_identities",
      "mfa_enabled",
      "boolean",
      (col) => col.default(false),
    );
    context.schema.addColumn(
      "citadelle_sessions",
      "ip_address",
      "string",
      (col) => col.nullable(),
    );
    context.schema.addColumn(
      "citadelle_sessions",
      "user_agent",
      "string",
      (col) => col.nullable(),
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropColumn("citadelle_sessions", "user_agent");
    context.schema.dropColumn("citadelle_sessions", "ip_address");
    context.schema.dropColumn("citadelle_identities", "mfa_enabled");
    context.schema.dropColumn("citadelle_identities", "last_login_at");
  },
  resources: ["table:citadelle_identities", "table:citadelle_sessions"],
};
