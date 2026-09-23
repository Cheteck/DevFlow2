import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

builder.createIndex("booking_slots", "idx_booking_slots_provider_time", ["providerId", "startTime", "endTime"]);

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922161800_harden_booking_constraints",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["index:idx_booking_slots_provider_time"]
};
