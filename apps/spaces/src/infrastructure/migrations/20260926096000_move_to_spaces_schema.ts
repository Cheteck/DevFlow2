import { computeChecksum, type Migration } from "@mosaix/migrations";

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

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "spaces";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "spaces";`,
  );
  // Same-name tables (permissions, roles, ...) must NOT be renamed to
  // themselves — Postgres raises "relation already exists".
  if (table.legacy !== table.clean) {
    upStatements.push(
      `ALTER TABLE IF EXISTS "spaces"."${table.legacy}" RENAME TO "${table.clean}";`,
    );
  }
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  if (table.legacy !== table.clean) {
    downStatements.push(
      `ALTER TABLE IF EXISTS "spaces"."${table.clean}" RENAME TO "${table.legacy}";`,
    );
  }
  downStatements.push(
    `ALTER TABLE IF EXISTS "spaces"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926096000_move_to_spaces_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:spaces.${table.clean}`),
};
