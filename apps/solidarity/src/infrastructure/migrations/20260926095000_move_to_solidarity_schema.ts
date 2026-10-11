import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * solidarity.relief.v1.002 — move the 7 Solidarity tables from `public`
 * into the dedicated `solidarity` schema and strip the redundant prefix.
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table. Postgres-only.
 */

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "solidarity_incidents", clean: "incidents" },
  { legacy: "solidarity_needs", clean: "needs" },
  { legacy: "solidarity_donations", clean: "donations" },
  { legacy: "solidarity_hubs", clean: "hubs" },
  { legacy: "solidarity_resources", clean: "resources" },
  { legacy: "solidarity_missions", clean: "missions" },
  { legacy: "solidarity_distributions", clean: "distributions" },
];

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "solidarity";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "solidarity";`,
    `ALTER TABLE IF EXISTS "solidarity"."${table.legacy}" RENAME TO "${table.clean}";`,
  );
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  downStatements.push(
    `ALTER TABLE IF EXISTS "solidarity"."${table.clean}" RENAME TO "${table.legacy}";`,
    `ALTER TABLE IF EXISTS "solidarity"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926095000_move_to_solidarity_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:solidarity.${table.clean}`),
};
