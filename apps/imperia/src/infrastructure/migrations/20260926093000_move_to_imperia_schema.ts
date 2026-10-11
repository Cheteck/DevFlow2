import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * imperia.ops.v1.002 — move the 5 Imperia tables from `public`
 * into the dedicated `imperia` schema and strip the redundant prefix.
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, indexes and
 * constraints with the table (no FKs in this BAC). Postgres-only.
 */

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "imperia_audit_logs", clean: "audit_logs" },
  { legacy: "imperia_policies", clean: "policies" },
  { legacy: "imperia_dlq", clean: "dlq" },
  { legacy: "imperia_circuit_breakers", clean: "circuit_breakers" },
  { legacy: "imperia_settings", clean: "settings" },
];

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "imperia";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "imperia";`,
    `ALTER TABLE IF EXISTS "imperia"."${table.legacy}" RENAME TO "${table.clean}";`,
  );
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  downStatements.push(
    `ALTER TABLE IF EXISTS "imperia"."${table.clean}" RENAME TO "${table.legacy}";`,
    `ALTER TABLE IF EXISTS "imperia"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926093000_move_to_imperia_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:imperia.${table.clean}`),
};
