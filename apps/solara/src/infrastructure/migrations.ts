import {
  SchemaBuilder,
  PostgresGrammar,
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export class SolaraPostgresMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "solara";
  }

  migrations(): readonly Migration[] {
    const builder = new SchemaBuilder();
    const grammar = new PostgresGrammar();

    builder.createTable("solara_posts", (table) => {
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

    builder.createTable("solara_comments", (table) => {
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

    builder.createTable("solara_followers", (table) => {
      table.string("id").primary();
      table.string("followerActorId");
      table.string("followerActorType").default("user");
      table.string("targetActorId");
      table.string("targetActorType").default("user");
      table.timestamp("createdAt");
      table.unique("uniq_solara_followers", ["followerActorId", "targetActorId"]);
      table.index("idx_solara_followers_target", ["targetActorId"]);
      table.index("idx_solara_followers_covering", ["followerActorId", "targetActorId", "followerActorType", "targetActorType"]);
    });

    builder.createTable("solara_reactions", (table) => {
      table.string("id").primary();
      table.string("targetType");
      table.string("targetId");
      table.string("actorId");
      table.string("actorType").default("user");
      table.string("type");
      table.timestamp("createdAt");
      table.index("idx_reactions_target", ["targetType", "targetId"]);
      table.index("idx_reactions_actor", ["actorId"]);
      table.index("idx_reactions_target_actor", ["targetType", "targetId", "actorId"]);
    });

    builder.createTable("solara_categories", (table) => {
      table.string("id").primary();
      table.string("name");
      table.string("slug");
      table.string("description").nullable();
      table.timestamp("createdAt");
      table.unique("uniq_solara_categories_slug", ["slug"]);
    });

    builder.createTable("solara_translations", (table) => {
      table.string("id").primary();
      table.string("postId");
      table.string("lang");
      table.string("translatedContent");
      table.timestamp("createdAt");
      table.foreignKey("postId", "solara_posts", "id");
      table.index("idx_solara_trans_post_lang", ["postId", "lang"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
      { type: "dropTable" as const, table: "solara_translations" },
      { type: "dropTable" as const, table: "solara_categories" },
      { type: "dropTable" as const, table: "solara_reactions" },
      { type: "dropTable" as const, table: "solara_followers" },
      { type: "dropTable" as const, table: "solara_comments" },
      { type: "dropTable" as const, table: "solara_posts" },
    ].flatMap((bp) => grammar.compile(bp));
    const downContent = downStatements.map((s) => s.sql).join("\n");

    const migrationId = "solara.v1.001_create_social_tables";

    return [
      {
        id: migrationId,
        content: sqlContent,
        down: downContent,
        checksum: computeChecksum(sqlContent),
        resources: [
          "table:solara_posts",
          "table:solara_comments",
          "table:solara_followers",
          "table:solara_reactions",
          "table:solara_categories",
          "table:solara_translations",
        ],
      },
    ];
  }
}