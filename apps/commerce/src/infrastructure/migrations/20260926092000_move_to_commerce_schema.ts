import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "196697b27aa75f3939092d0e4a64109cea618214058b9c024b8cc956b3fc9867";
/* checksum:end */

/**
 * commerce.shop.v1.002 — move the 7 Commerce tables from `public`
 * into the dedicated `commerce` schema and strip the redundant prefix.
 *
 * Data-preserving: SET SCHEMA + RENAME move rows, PKs, FKs (all intra-BAC),
 * indexes and constraints with the table. Postgres-only.
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
  { legacy: "commerce_orders", clean: "orders" },
  { legacy: "commerce_offers", clean: "offers" },
  { legacy: "commerce_payment_intents", clean: "payment_intents" },
  { legacy: "commerce_auctions", clean: "auctions" },
  { legacy: "commerce_auction_bids", clean: "auction_bids" },
  { legacy: "commerce_carts", clean: "carts" },
  { legacy: "commerce_cart_items", clean: "cart_items" },
];

export const migration: Migration = {
  id: "commerce.shop.v1.002_move_to_schema",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["9a5acfb818f3c5db"],
  resources: MOVES.map((table) => `table:commerce.${table.clean}`),
  up: (context: MigrationContext) => {
    context.schema.createSchema("commerce");
    for (const table of MOVES) {
      context.schema.moveTableToSchema(table.legacy, "public", "commerce");
      // Same-name tables must NOT be renamed to themselves (Postgres error).
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema(
          "commerce",
          table.legacy,
          table.clean,
        );
      }
    }
  },
  downMigration: (context: MigrationContext) => {
    for (const table of [...MOVES].reverse()) {
      if (table.legacy !== table.clean) {
        context.schema.renameTableInSchema(
          "commerce",
          table.clean,
          table.legacy,
        );
      }
      context.schema.moveTableToSchema(table.legacy, "commerce", "public");
    }
  },
};
