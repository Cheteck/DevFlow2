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
      table.string("publicationType");
      table.json("data");
      table.index("idx_solara_posts_actor", ["actorId"]);
      table.index("idx_solara_posts_type", ["publicationType"]);
    });

    builder.createTable("solara_comments", (table) => {
      table.string("id").primary();
      table.string("postId");
      table.string("actorId");
      table.string("content");
      table.timestamp("createdAt");
      table.foreignKey("postId", "solara_posts", "id");
      table.index("idx_solara_comments_post", ["postId"]);
      table.index("idx_solara_comments_actor", ["actorId"]);
    });

    builder.createTable("solara_followers", (table) => {
      table.string("followerActorId");
      table.string("targetActorId");
      table.timestamp("createdAt");
      table.unique("uniq_solara_followers", ["followerActorId", "targetActorId"]);
      table.index("idx_solara_followers_target", ["targetActorId"]);
    });

    builder.createTable("solara_reactions", (table) => {
      table.string("id").primary();
      table.string("postId");
      table.string("actorId");
      table.string("type");
      table.timestamp("createdAt");
      table.foreignKey("postId", "solara_posts", "id");
      table.index("idx_reactions_post", ["postId"]);
      table.index("idx_reactions_actor", ["actorId"]);
    });

    const statements = builder.blueprints.flatMap((bp) => grammar.compile(bp));
    const sqlContent = statements.map((s) => s.sql).join("\n");

    const downStatements = [
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
        ],
      },
    ];
  }
}
