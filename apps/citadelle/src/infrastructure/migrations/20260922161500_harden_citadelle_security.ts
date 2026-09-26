import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

// Renforcement sécurité Citadelle
builder.addColumn("citadelle_identities", "last_login_at", "timestamp", (col) => col.nullable());
builder.addColumn("citadelle_identities", "mfa_enabled", "boolean", (col) => col.default(false));
builder.addColumn("citadelle_sessions", "ip_address", "string", (col) => col.nullable());
builder.addColumn("citadelle_sessions", "user_agent", "string", (col) => col.nullable());

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922161500_harden_citadelle_security",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:citadelle_identities", "table:citadelle_sessions"],
};
