import { SchemaBuilder, PostgresGrammar, computeChecksum, type Migration } from "@mosaix/migrations";

const builder = new SchemaBuilder();
const grammar = new PostgresGrammar();

builder.createTable("portfolio_proposals", (table) => {
  table.string("id").primary();
  table.string("spaceId");
  table.string("proposerUserId");
  table.string("suggestedReference");
  table.string("type");
  table.string("status");
  table.json("content");
  table.json("classification");
  table.json("characteristics");
  table.json("features");
  table.json("variants");
  table.json("media");
  table.json("translations");
  table.string("platformFeedback").nullable();
  table.string("rejectionReason").nullable();
  table.string("reviewedBy").nullable();
  table.timestamp("reviewStartedAt").nullable();
  table.string("vendableId").nullable();
  table.timestamp("submittedAt").nullable();
  table.timestamp("reviewedAt").nullable();
  table.timestamp("createdAt");
  table.timestamp("updatedAt");
  table.foreignKey("vendableId", "portfolio_vendables", "id");
  table.index("idx_proposals_space_status", ["spaceId", "status"]);
});

const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
const sqlContent = statements.map((s) => s.sql).join("\n");
const downStatements = [{ type: "dropTable" as const, table: "portfolio_proposals" }].flatMap((bp) =>
  grammar.compile(bp),
);

export const migration: Migration = {
  id: "20260924120000_create_portfolio_proposals",
  content: sqlContent,
  down: downStatements.map((s) => s.sql).join("\n"),
  checksum: computeChecksum(sqlContent),
  resources: ["table:portfolio_proposals"],
};
