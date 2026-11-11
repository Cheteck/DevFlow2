import { type Migration, type MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "7e6e0b2c80f27e0428f88ae11b352d1b095859163d27be9d12d950214c6b4934";
/* checksum:end */

/**
 * portfolio.catalog.v1.002_create_proposals
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
  id: "portfolio.catalog.v1.002_create_proposals",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["e4e63c21d32c6879"],
  up: (context: MigrationContext) => {
    context.schema.createTable("portfolio_proposals", (table) => {
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
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable("portfolio_proposals");
  },
  resources: ["table:portfolio_proposals"],
};
