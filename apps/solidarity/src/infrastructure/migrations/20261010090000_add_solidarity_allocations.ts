import {
  func,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "11ba432ec5899e13b5d35494b144187bd0aacac07f77160c15f6fdaf734e269a";
/* checksum:end */

/**
 * solidarity.relief.v1.003 — durable allocation ledger for confirmed
 * resource allocations (responsibilities.md §2.3, §2.4, §8).
 *
 * The UNIQUE key on "idempotencyKey" enforces idempotence at the database
 * level: a replayed confirmation resolves to the stored row instead of
 * reserving stock twice, even across process restarts.
 *
 * Postgres-only. Applies on the `solidarity.*` names (v1.002).
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

export const migration: Migration = {
  id: "solidarity.relief.v1.003_allocations",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["feb68b8fd58a3bea"],
  resources: ["table:solidarity.allocations"],
  up: (context: MigrationContext) => {
    context.schema.createTable(
      "allocations",
      (table) => {
        table.text("id").primary();
        table.text("idempotencyKey");
        table.text("needId");
        table.text("stockId");
        table.text("hubId");
        table.integer("quantity").check('"quantity" > 0');
        table.text("unit");
        table.text("status");
        table.json("data");
        table.timestamp("createdAt").default(func("now"));
      },
      { ifNotExists: true, schema: "solidarity" },
    );
    context.schema.createIndex(
      { schema: "solidarity", name: "allocations" },
      "uniq_allocations_idempotency",
      [{ name: "idempotencyKey" }],
      { unique: true, ifNotExists: true },
    );
    context.schema.createIndex(
      { schema: "solidarity", name: "allocations" },
      "idx_allocations_need",
      [{ name: "needId" }],
      { ifNotExists: true },
    );
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable(
      { schema: "solidarity", name: "allocations" },
      { ifExists: true, schema: "solidarity" },
    );
  },
};
