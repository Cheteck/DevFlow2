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

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
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
        ],
      },
    ];
  }
}
