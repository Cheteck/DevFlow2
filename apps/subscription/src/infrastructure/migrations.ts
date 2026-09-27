import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

/**
 * BAC subscription — tables Postgres possédées par le BAC.
 *
 * Phase-0 (DB-BAC-OWNERSHIP) : `user_subscriptions` est EXCLUE ici, en
 * `up` comme en `down`. Le shell reste propriétaire temporaire via
 * `shell.core.v1.002` (`src/shell/database/core-migration.ts`) car les
 * schémas divergent (`cancel_at_period_end` BOOLEAN côté BAC contre
 * INTEGER côté shell, et `PostgresGrammar` émet `CREATE TABLE` sans
 * `IF NOT EXISTS`). Le wrapper `SubscriptionPhase0Provider`
 * (`src/shell/bac-migrations.ts`, lecture seule depuis ce BAC) filtre
 * en outre toute instruction visant cette table : l'exclusion est donc
 * effective deux fois (par construction ici, par filtre côté shell).
 * Les clés étrangères `invoices`/`metering_buckets → user_subscriptions`
 * sont conservées : le shell crée la table au rang 0, avant ce provider
 * (rang 1), les références se résolvent. Le transfert complet
 * d'ownership est du ressort de la vague subscription (backlog).
 *
 * Types : `PostgresGrammar`/`SchemaBuilder` (`packages/migrations`,
 * hors périmètre de cette vague) ne connaissent pas `bigint` — seuls
 * `string | integer | decimal | uuid | timestamp | json | enum | boolean`
 * existent. Les dates BAC utilisent donc `timestamp`
 * (`TIMESTAMP WITH TIME ZONE`, pas d'overflow) et `integer` reste réservé
 * aux montants en centimes et compteurs (jamais des epoch-ms) :
 * aucun `Date.now()` ms ne transite par un `INTEGER` de cette migration.
 * L'ajout d'un type `bigint` à la grammaire est proposé en backlog.
 *
 * Unicité partielle : pas de `UNIQUE(user_id)` filtré sur les statuts
 * actifs ici — `IndexDefinition` ne supporte pas de clause `WHERE`, et la
 * table concernée (`user_subscriptions`) est shell-owned. Proposition de
 * migration follow-up en backlog (voir rapport de vague).
 */
export class SubscriptionPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "subscription";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    // 1. Coupons
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

    // 2. Invoices
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

    // 3. Metering Buckets
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
          "table:coupons",
          "table:invoices",
          "table:metering_buckets",
        ],
      },
    ];
  }
}
