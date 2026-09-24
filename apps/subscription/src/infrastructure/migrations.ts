import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class SubscriptionPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "subscription";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    // 1. User Subscriptions
    builder.createTable("user_subscriptions", (table) => {
      table.string("id").primary();
      table.string("user_id");
      table.string("plan_id");
      table.string("status");
      table.integer("current_period_start");
      table.integer("current_period_end");
      table.boolean("cancel_at_period_end").default(false);
      table.integer("metered_usage_units").default(0);
      table.integer("created_at");
      table.integer("updated_at");
      table.index("idx_user_subscriptions_user", ["user_id"]);
      table.index("idx_user_subscriptions_status", ["status"]);
    });

    // 2. Coupons
    builder.createTable("coupons", (table) => {
      table.string("id").primary();
      table.string("code");
      table.integer("discountPercent").nullable();
      table.integer("discountAmountInCents").nullable();
      table.integer("maxRedemptions").default(100);
      table.integer("redemptionsCount").default(0);
      table.timestamp("expiresAt").nullable();
      table.timestamp("createdAt");
      table.unique("uniq_coupons_code", ["code"]);
    });

    // 3. Invoices
    builder.createTable("invoices", (table) => {
      table.string("id").primary();
      table.string("subscriptionId");
      table.string("userId");
      table.integer("amountInCents");
      table.string("currency").default("EUR");
      table.enum("status", ["Draft", "Open", "Paid", "Uncollectible", "Void"]);
      table.string("invoicePdfUrl").nullable();
      table.timestamp("createdAt");
      table.foreignKey("subscriptionId", "user_subscriptions", "id");
      table.index("idx_invoices_user", ["userId"]);
      table.index("idx_invoices_subscription", ["subscriptionId"]);
    });

    // 4. Metering Buckets
    builder.createTable("metering_buckets", (table) => {
      table.string("id").primary();
      table.string("subscriptionId");
      table.string("userId");
      table.string("metric");
      table.integer("units").default(0);
      table.timestamp("bucketTimestamp");
      table.timestamp("createdAt");
      table.foreignKey("subscriptionId", "user_subscriptions", "id");
      table.index("idx_metering_sub_bucket", ["subscriptionId", "bucketTimestamp"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "metering_buckets" },
      { type: "dropTable" as const, table: "invoices" },
      { type: "dropTable" as const, table: "coupons" },
      { type: "dropTable" as const, table: "user_subscriptions" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "subscription.v1.001_create_subscription_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:user_subscriptions",
          "table:coupons",
          "table:invoices",
          "table:metering_buckets",
        ],
      },
    ];
  }
}
