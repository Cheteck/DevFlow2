import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * solara.social.v1.002 — move the 6 Solara tables from `public`
 * into the dedicated `solara` schema and strip the redundant prefix.
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table. Postgres-only.
 */

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "solara_posts", clean: "posts" },
  { legacy: "solara_comments", clean: "comments" },
  { legacy: "solara_followers", clean: "followers" },
  { legacy: "solara_reactions", clean: "reactions" },
  { legacy: "solara_categories", clean: "categories" },
  { legacy: "solara_translations", clean: "translations" },
];

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "solara";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "solara";`,
    `ALTER TABLE IF EXISTS "solara"."${table.legacy}" RENAME TO "${table.clean}";`,
  );
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  downStatements.push(
    `ALTER TABLE IF EXISTS "solara"."${table.clean}" RENAME TO "${table.legacy}";`,
    `ALTER TABLE IF EXISTS "solara"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926094000_move_to_solara_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:solara.${table.clean}`),
};
