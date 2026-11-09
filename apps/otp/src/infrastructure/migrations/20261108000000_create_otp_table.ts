import {
  computeChecksum,
  type Migration,
  SchemaBuilder,
  PostgresGrammar,
  SQLiteGrammar,
} from "@mosaix/migrations";

/**
 * @apps/otp — Create otp table (SchemaBuilder DSL, TypeScript).
 *
 * Builds the schema programmatically via `@mosaix/migrations` SchemaBuilder
 * instead of hand-written SQL strings, so the same blueprint compiles for
 * both Postgres and SQLite grammars.
 */
const builder = new SchemaBuilder();

builder.createTable("otp", (table) => {
  table.string("id").primary();
  table.string("tenant_id");
  table.string("destination");
  table.string("channel");
  table.string("purpose");
  table.string("user_id").nullable();
  table.string("code_hash");
  table.integer("created_at");
  table.integer("expires_at");
  table.integer("consumed_at").nullable();
  table.integer("attempts").default(0);
  table.integer("max_attempts").default(5);

  table.index("idx_otp_tenant_destination_purpose_user", [
    "tenant_id",
    "destination",
    "purpose",
    "user_id",
  ]);
});

const statementsPg = builder
  .compile(new PostgresGrammar())
  .map((s) => s.sql);

const statementsSqlite = builder
  .compile(new SQLiteGrammar())
  .map((s) => s.sql);

const migration: Migration = {
  id: "20261108000000_create_otp_table",
  content: statementsPg.join("\n"),
  down: `DROP TABLE IF EXISTS otp;`,
  checksum: computeChecksum(statementsPg.join("\n")),
  resources: ["table:otp"],
};

export default migration;

export const migrationSqlite: Migration = {
  id: "20261108000000_create_otp_table_sqlite",
  content: statementsSqlite.join("\n"),
  down: `DROP TABLE IF EXISTS otp;`,
  checksum: computeChecksum(statementsSqlite.join("\n")),
  resources: ["table:otp"],
};
