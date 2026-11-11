import type { Migration, MigrationContext } from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM =
  "1642af73f019ee0071953a4140cf8ac12ad51d298108a985110b664e46d4ed9d";
/* checksum:end */

/**
 * solara.social.v1.001_create_social_tables
 *
 * Creates the six social tables of the Solara BAC (posts, comments,
 * followers, reactions, categories, translations) with their indexes,
 * unique constraints and intra-BAC foreign keys.
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles
 * the blueprints with the dialect grammar (PostgreSQL for this BAC) and
 * executes the resulting statements. No SQL string is carried by the
 * migration.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */
export const migration: Migration = {
  id: "solara.social.v1.001_create_social_tables",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["227693bae95b7667"],
  resources: [
    "table:solara_posts",
    "table:solara_comments",
    "table:solara_followers",
    "table:solara_reactions",
    "table:solara_categories",
    "table:solara_translations",
  ],
  up: (context: MigrationContext) => {
    context.schema.createTable("solara_posts", (table) => {
      table.string("id").primary();
      table.string("actorId");
      table.string("actorType").default("user");
      table.string("publicationType");
      table.string("targetType").default("feed");
      table.string("targetId").nullable();
      table.string("content");
      table.json("mediaUrls").nullable();
      table.json("metadata").nullable();
      table.integer("likeCount").default(0);
      table.integer("commentsCount").default(0);
      table.timestamp("createdAt");
      table.index("idx_solara_posts_actor", ["actorId"]);
      table.index("idx_solara_posts_type", ["publicationType"]);
      table.index("idx_solara_posts_created_at", ["createdAt"]);
    });

    context.schema.createTable("solara_comments", (table) => {
      table.string("id").primary();
      table.string("postId");
      table.string("actorId");
      table.string("actorType").default("user");
      table.string("content");
      table.timestamp("createdAt");
      table.foreignKey("postId", "solara_posts", "id");
      table.index("idx_solara_comments_post", ["postId"]);
      table.index("idx_solara_comments_actor", ["actorId"]);
    });

    context.schema.createTable("solara_followers", (table) => {
      table.string("id").primary();
      table.string("followerActorId");
      table.string("followerActorType").default("user");
      table.string("targetActorId");
      table.string("targetActorType").default("user");
      table.timestamp("createdAt");
      table.unique("uniq_solara_followers", [
        "followerActorId",
        "targetActorId",
      ]);
      table.index("idx_solara_followers_target", ["targetActorId"]);
      table.index("idx_solara_followers_covering", [
        "followerActorId",
        "targetActorId",
        "followerActorType",
        "targetActorType",
      ]);
    });

    context.schema.createTable("solara_reactions", (table) => {
      table.string("id").primary();
      table.string("targetType");
      table.string("targetId");
      table.string("actorId");
      table.string("actorType").default("user");
      table.string("type");
      table.timestamp("createdAt");
      table.index("idx_reactions_target", ["targetType", "targetId"]);
      table.index("idx_reactions_actor", ["actorId"]);
      table.index("idx_reactions_target_actor", [
        "targetType",
        "targetId",
        "actorId",
      ]);
    });

    context.schema.createTable("solara_categories", (table) => {
      table.string("id").primary();
      table.string("name");
      table.string("slug");
      table.string("description").nullable();
      table.timestamp("createdAt");
      table.unique("uniq_solara_categories_slug", ["slug"]);
    });

    context.schema.createTable("solara_translations", (table) => {
      table.string("id").primary();
      table.string("postId");
      table.string("lang");
      table.string("translatedContent");
      table.timestamp("createdAt");
      table.foreignKey("postId", "solara_posts", "id");
      table.index("idx_solara_trans_post_lang", ["postId", "lang"]);
    });
  },
  downMigration: (context: MigrationContext) => {
    context.schema.dropTable("solara_translations");
    context.schema.dropTable("solara_categories");
    context.schema.dropTable("solara_reactions");
    context.schema.dropTable("solara_followers");
    context.schema.dropTable("solara_comments");
    context.schema.dropTable("solara_posts");
  },
};
