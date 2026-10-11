import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * booking.scheduling.v1.002 — move the 4 Booking tables from `public`
 * into the dedicated `booking` schema and strip the redundant prefix.
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table. Postgres-only.
 */

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "booking_slots", clean: "slots" },
  { legacy: "booking_reservations", clean: "reservations" },
  { legacy: "booking_waitlists", clean: "waitlists" },
  { legacy: "booking_reminders", clean: "reminders" },
];

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "booking";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "booking";`,
    `ALTER TABLE IF EXISTS "booking"."${table.legacy}" RENAME TO "${table.clean}";`,
  );
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  downStatements.push(
    `ALTER TABLE IF EXISTS "booking"."${table.clean}" RENAME TO "${table.legacy}";`,
    `ALTER TABLE IF EXISTS "booking"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926091000_move_to_booking_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:booking.${table.clean}`),
};
