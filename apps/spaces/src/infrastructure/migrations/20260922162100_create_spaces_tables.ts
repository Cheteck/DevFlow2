import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

builder.createTable("spaces_spaces", (table) => {
  table.string("id").primary();
  table.string("name");
  table.string("slug");
  table.string("category").nullable();
  table.string("template").nullable();
  table.string("ownerId");
  table.string("tenantId").nullable();
  table.integer("followersCount").default(0);
  table.string("customDomain").nullable();
  table.json("enabledCapabilities").nullable();
  table.json("publicNavigation").nullable();
  table.json("team").nullable();
  table.json("data");
  table.timestamp("createdAt");
  table.timestamp("updatedAt").nullable();
  table.unique("uniq_spaces_slug", ["slug"]);
  table.index("idx_spaces_owner", ["ownerId"]);
  table.index("idx_spaces_tenant", ["tenantId"]);
  table.index("idx_spaces_domain", ["customDomain"]);
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));

export const migration: Migration = {
  id: "20260922162100_create_spaces_tables",
  content: statements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(statements.map((s) => s.sql).join("\n")),
  resources: ["table:spaces_spaces"]
};
