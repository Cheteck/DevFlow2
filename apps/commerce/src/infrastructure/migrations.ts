import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class CommercePostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "commerce";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    // 1. Orders
    builder.createTable("commerce_orders", (table) => {
      table.string("id").primary();
      table.string("userId");
      table.string("vendableId").nullable();
      table.string("customerId").nullable();
      table.enum("status", [
        "Pending",
        "Paid",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
        "Refunded",
      ]);
      table.string("currency").default("EUR");
      table.decimal("totalAmount").default(0);
      table.decimal("taxAmount").default(0);
      table.string("discountCode").nullable();
      table.json("shippingAddress").nullable();
      table.json("billingAddress").nullable();
      table.json("lineItems").nullable();
      table.json("items").nullable();
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.timestamp("deletedAt").nullable();
      table.index("idx_orders_user", ["userId"]);
      table.index("idx_orders_status", ["status"]);
      table.index("idx_orders_vendable", ["vendableId"]);
    });

    // 2. Offers
    builder.createTable("commerce_offers", (table) => {
      table.string("id").primary();
      table.string("vendableId");
      table.string("sellerId");
      table.string("sellerType").default("user");
      table.integer("priceInCents");
      table.string("currency").default("EUR");
      table.integer("commissionRateBps").default(500);
      table.integer("stockQuantity").default(1);
      table.enum("status", ["Active", "Inactive", "SoldOut", "Archived"]);
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.index("idx_offers_vendable", ["vendableId"]);
      table.index("idx_offers_seller", ["sellerId"]);
      table.index("idx_offers_status", ["status"]);
    });

    // 3. Payment Intents
    builder.createTable("commerce_payment_intents", (table) => {
      table.string("id").primary();
      table.string("orderId");
      table.string("userId");
      table.integer("amountInCents");
      table.string("currency").default("EUR");
      table.string("status");
      table.string("clientSecret").nullable();
      table.integer("amountReceivedInCents").default(0);
      table.integer("amountRefundedInCents").default(0);
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.foreignKey("orderId", "commerce_orders", "id");
      table.index("idx_payment_intents_order", ["orderId"]);
      table.index("idx_payment_intents_user", ["userId"]);
    });

    // 4. Auctions
    builder.createTable("commerce_auctions", (table) => {
      table.string("id").primary();
      table.string("vendableId");
      table.string("sellerId");
      table.integer("startingPriceInCents");
      table.integer("reservePriceInCents").nullable();
      table.integer("currentHighBidInCents").default(0);
      table.enum("status", ["Draft", "Active", "Extended", "Closed", "Cancelled"]);
      table.timestamp("startTime");
      table.timestamp("endTime");
      table.boolean("antiSnipingTriggered").default(false);
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.index("idx_auctions_vendable", ["vendableId"]);
      table.index("idx_auctions_seller", ["sellerId"]);
      table.index("idx_auctions_status", ["status"]);
    });

    // 5. Auction Bids
    builder.createTable("commerce_auction_bids", (table) => {
      table.string("id").primary();
      table.string("auctionId");
      table.string("bidderId");
      table.integer("amountInCents");
      table.string("auditHash");
      table.string("previousHash").nullable();
      table.timestamp("createdAt");
      table.foreignKey("auctionId", "commerce_auctions", "id");
      table.index("idx_auction_bids_auction", ["auctionId"]);
      table.index("idx_auction_bids_bidder", ["bidderId"]);
    });

    // 6. Carts & Cart Items
    builder.createTable("commerce_carts", (table) => {
      table.string("id").primary();
      table.string("userId");
      table.string("currency").default("EUR");
      table.json("data").nullable();
      table.timestamp("createdAt");
      table.timestamp("updatedAt");
      table.unique("uniq_carts_user", ["userId"]);
      table.index("idx_carts_user", ["userId"]);
    });

    builder.createTable("commerce_cart_items", (table) => {
      table.string("id").primary();
      table.string("cartId");
      table.string("vendableId");
      table.string("offerId").nullable();
      table.integer("quantity").default(1);
      table.integer("unitPriceInCents");
      table.timestamp("createdAt");
      table.foreignKey("cartId", "commerce_carts", "id");
      table.index("idx_cart_items_cart", ["cartId"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "commerce_cart_items" },
      { type: "dropTable" as const, table: "commerce_carts" },
      { type: "dropTable" as const, table: "commerce_auction_bids" },
      { type: "dropTable" as const, table: "commerce_auctions" },
      { type: "dropTable" as const, table: "commerce_payment_intents" },
      { type: "dropTable" as const, table: "commerce_offers" },
      { type: "dropTable" as const, table: "commerce_orders" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "commerce.v1.001_create_commerce_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:commerce_orders",
          "table:commerce_offers",
          "table:commerce_payment_intents",
          "table:commerce_auctions",
          "table:commerce_auction_bids",
          "table:commerce_carts",
          "table:commerce_cart_items",
        ],
      },
    ];
  }
}
