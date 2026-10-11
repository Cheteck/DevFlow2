import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * commerce.shop.v1.002 — move the 7 Commerce tables from `public`
 * into the dedicated `commerce` schema and strip the redundant prefix.
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table. Postgres-only.
 */

const MOVES: Array<{ legacy: string; clean: string }> = [
  { legacy: "commerce_orders", clean: "orders" },
  { legacy: "commerce_offers", clean: "offers" },
  { legacy: "commerce_payment_intents", clean: "payment_intents" },
  { legacy: "commerce_auctions", clean: "auctions" },
  { legacy: "commerce_auction_bids", clean: "auction_bids" },
  { legacy: "commerce_carts", clean: "carts" },
  { legacy: "commerce_cart_items", clean: "cart_items" },
];

const upStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "commerce";`];
for (const table of MOVES) {
  upStatements.push(
    `ALTER TABLE IF EXISTS "public"."${table.legacy}" SET SCHEMA "commerce";`,
    `ALTER TABLE IF EXISTS "commerce"."${table.legacy}" RENAME TO "${table.clean}";`,
  );
}

const downStatements: string[] = [];
for (const table of [...MOVES].reverse()) {
  downStatements.push(
    `ALTER TABLE IF EXISTS "commerce"."${table.clean}" RENAME TO "${table.legacy}";`,
    `ALTER TABLE IF EXISTS "commerce"."${table.legacy}" SET SCHEMA "public";`,
  );
}

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926092000_move_to_commerce_schema",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: MOVES.map((table) => `table:commerce.${table.clean}`),
};
