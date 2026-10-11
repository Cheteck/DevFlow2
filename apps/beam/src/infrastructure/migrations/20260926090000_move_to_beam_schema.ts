import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * beam.messaging.v1.002 — move the 4 Beam tables from `public`
 * into the dedicated `beam` schema and strip the redundant prefix
 * (`beam.beam_messages` would stutter → `beam.messages`).
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table. Postgres-only.
 */

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "beam_conversations", clean: "conversations" },
  { legacy: "beam_messages", clean: "messages" },
  { legacy: "beam_notifications", clean: "notifications" },
  { legacy: "beam_push_subscriptions", clean: "push_subscriptions" },
];

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "beam";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "beam";`,
    `ALTER TABLE IF EXISTS "beam"."${table.legacy}" RENAME TO "${table.clean}";`,
  );
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  downStatements.push(
    `ALTER TABLE IF EXISTS "beam"."${table.clean}" RENAME TO "${table.legacy}";`,
    `ALTER TABLE IF EXISTS "beam"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926090000_move_to_beam_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:beam.${table.clean}`),
};
