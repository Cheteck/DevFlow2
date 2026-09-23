import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

builder.addColumn("solidarity_offers", "confirmed_at", "timestamp", (col) => col.nullable());
builder.addColumn("solidarity_offers", "completed_at", "timestamp", (col) => col.nullable());

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922161900_add_solidarity_transaction_state",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:solidarity_offers"]
};
