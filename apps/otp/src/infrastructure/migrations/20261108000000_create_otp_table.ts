import { computeChecksum, type Migration, SchemaBuilder, PostgresGrammar, SqliteGrammar } from "@mosaix/migrations";

const builder = new SchemaBuilder();

builder.createTable("otp", (table) => {
  table.column("id", "text", { primary: true });
  table.column("tenant_id", "text", { nullable: false });
  table.column("destination", "text", { nullable: false });
  table.column("channel", "text", { nullable: false });
  table.column("purpose", "text", { nullable: false });
  table.column("user_id", "text");
  table.column("code_hash", "text", { nullable: false });
  table.column("created_at", "integer", { nullable: false });
  table.column("expires_at", "integer", { nullable: false });
  table.column("consumed_at", "integer");
  table.column("attempts", "integer", { nullable: false, default: 0 });
  table.column("max_attempts", "integer", { nullable: false, default: 5 });

  table.index(["tenant_id", "destination", "purpose", "user_id"]);
});

const statementsPg = builder
  .compile(
    builder.tableStatements("otp"),
    new PostgresGrammar()
  ).map((s) => s.sql);

const statementsSqlite = builder
  .compile(
    builder.tableStatements("otp"),
    new SqliteGrammar()
  ).map((s) => s.sql);

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
