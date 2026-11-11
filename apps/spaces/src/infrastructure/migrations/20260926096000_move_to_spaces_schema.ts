import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "636b6ea51d8f56f826e118d4ed5f6b7f11134eb93bb4d54eb9c5194d66cbc725";
/* checksum:end */

/**
 * spaces.membership.v1.002 — move the 9 Spaces tables from `public`
 * into the dedicated `spaces` schema and strip the redundant prefix
 * (`spaces.spaces_spaces` would stutter → `spaces.spaces`).
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table. Postgres-only.
 *
 * Note: the legacy shell `space_members` snake_case table stays in `public`
 * untouched (different shape, different owner).
 *
 * The SchemaBuilder DSL cannot express `SET SCHEMA`: the DDL is therefore
 * declared explicitly as raw SQL (PostgreSQL only), the documented escape
 * hatch of the engine for dialect-specific DDL.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
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

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "spaces_spaces", clean: "spaces" },
  { legacy: "permissions", clean: "permissions" },
  { legacy: "roles", clean: "roles" },
  { legacy: "role_permissions", clean: "role_permissions" },
  { legacy: "global_user_roles", clean: "global_user_roles" },
  { legacy: "space_members", clean: "space_members" },
  { legacy: "permission_overrides", clean: "permission_overrides" },
  { legacy: "acting_as_audit_events", clean: "acting_as_audit_events" },
  { legacy: "role_audit_events", clean: "role_audit_events" },
];

export const migration: Migration = {
  id: "spaces.membership.v1.002_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["6f7ea914fbe40059"],
  resources: MOVES.map((table) => `table:spaces.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("spaces");
    for (const table of MOVES) {
      context.schema.moveTableToSchema(table.legacy, "public", "spaces");
      // Same-name tables must NOT be renamed to themselves (Postgres error).
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema("spaces", table.legacy, table.clean);
      }
    }
  },
  downMigration: (context: MigrationContext) => {
    for (const table of [...MOVES].reverse()) {
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema("spaces", table.clean, table.legacy);
      }
      context.schema.moveTableToSchema(table.legacy, "spaces", "public");
    }
  },
};
