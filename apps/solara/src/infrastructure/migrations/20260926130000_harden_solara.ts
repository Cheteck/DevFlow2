import {
  func,
  type Migration,
  type MigrationContext,
} from "@mosaix/migrations";

/* checksum:begin */
export const MIGRATION_CHECKSUM = "901437a8513efb68858efbf76ab3cae1be074272703ace1dbdcd693ac4de4d86";
/* checksum:end */

/**
 * solara.social.v1.003_harden_social
 *
 * Hardens the social integrity of the Solara BAC (critique schéma).
 *
 * Verified against the live DB before writing: creation order is correct
 * (posts before dependents), indexes are valid — the syntax/order claims do
 * NOT apply to our compiled migrations. This migration adds what is REALLY
 * missing, on the `solara.*` names (v1.002):
 *
 * - reactions: UNIQUE(targetType,targetId,actorType,actorId) — one active
 *   reaction per actor and target (type changes update in place); race-safe
 *   duplicates impossible (app check-then-insert is not enough).
 * - followers: UNIQUE extended to the full actor quad (ids alone are not
 *   provably global across actor types); self-follow CHECK.
 * - translations: UNIQUE(postId,lang); drop the now-redundant plain index.
 * - Controlled vocabularies (closed unions in social.model.ts):
 *   actorType (user/space/organization/system), post targetType
 *   (feed/space/group/event), reaction targetType (post/comment) and type
 *   (like/love/laugh/surprised/sad/angry). publicationType stays OPEN
 *   (extensible registry by design).
 * - Counters fenced >= 0 (increments stay atomic in the repo:
 *   UPDATE ... SET count = count + delta).
 * - Long free text to TEXT (posts/comments content, translatedContent,
 *   categories description).
 * - DEFAULT now() on createdAt.
 * - Chronological determinism support: comments(postId,createdAt,id),
 *   posts(createdAt DESC,id DESC); followers target composite.
 *
 * Deliberately NOT changed (documented in docs/bacs/02-solara.md):
 * polymorphic actors stay (Option A — validation at app layer via content
 * hooks + Citadelle/Spaces capabilities, no cross-BAC FKs by design);
 * no parentCommentId (no threading in code); categories stay unlinked
 * (dead table, no repo); mediaUrls stays JSONB of stable keys
 * (signed URLs generated at serve time, never stored); no cursor
 * pagination yet (tiebreak ids added, cursor API deferred); moderation,
 * visibility, blocks, reports tables deferred to a dedicated pass.
 *
 * The schema is declared with the SchemaBuilder DSL: the engine compiles the
 * blueprints with the PostgreSQL grammar and executes the resulting
 * statements. Only the constraint expressions (UNIQUE / CHECK) are written
 * by hand — the statements themselves are generated.
 *
 * Historical note: this migration was previously declared as a raw SQL
 * string (SQL legacy mode, removed from the engine). Its historical
 * checksum is kept in `legacyChecksums` so that databases where it is
 * already applied are not rejected by the Planner.
 */

/** The `solara` schema, the owner of the social tables. */
const SOLARA = { schema: "solara" } as const;

export const migration: Migration = {
  id: "solara.social.v1.003_harden_social",
  checksum: MIGRATION_CHECKSUM,
  legacyChecksums: ["a50dd11588c8df27"],
  resources: [
    // v1.003_harden_social AJOUTE des contraintes/index a des tables existantes
    // (reactions, followers, translations, posts, comments, categories).
    // R9 exige au moins une ressource déclarée pour la détection de collisions.
    "table:solara.reactions",
    "table:solara.followers",
    "table:solara.translations",
    "table:solara.posts",
    "table:solara.comments",
    "table:solara.categories",
  ],
  up: (context: MigrationContext) => {
    // 1. Reactions: one active reaction per actor and target.
    context.schema.addConstraint(
      { ...SOLARA, name: "reactions" },
      "reactions_one_per_actor_target",
      'UNIQUE ("targetType", "targetId", "actorType", "actorId")',
    );
    context.schema.addConstraint(
      { ...SOLARA, name: "reactions" },
      "reactions_type_check",
      "CHECK (\"type\" IN ('like', 'love', 'laugh', 'surprised', 'sad', 'angry'))",
    );
    context.schema.addConstraint(
      { ...SOLARA, name: "reactions" },
      "reactions_target_check",
      "CHECK (\"targetType\" IN ('post', 'comment'))",
    );
    context.schema.addConstraint(
      { ...SOLARA, name: "reactions" },
      "reactions_actor_check",
      "CHECK (\"actorType\" IN ('user', 'space', 'organization', 'system'))",
    );

    // 2. Followers: full-quad uniqueness + no self-follow.
    // NOTE: v1.001 created uniq_solara_followers as a standalone UNIQUE INDEX
    // (not a table constraint): it must be dropped as an INDEX. Both forms
    // are attempted (IF EXISTS) to stay robust across database histories.
    context.schema.dropConstraint(
      { ...SOLARA, name: "followers" },
      "uniq_solara_followers",
    );
    context.schema.dropIndex("uniq_solara_followers", SOLARA.schema);
    context.schema.addConstraint(
      { ...SOLARA, name: "followers" },
      "followers_pair_unique",
      'UNIQUE ("followerActorType", "followerActorId", "targetActorType", "targetActorId")',
    );
    context.schema.addConstraint(
      { ...SOLARA, name: "followers" },
      "followers_no_self_follow",
      'CHECK ("followerActorType" <> "targetActorType" OR "followerActorId" <> "targetActorId")',
    );
    context.schema.addConstraint(
      { ...SOLARA, name: "followers" },
      "followers_actor_check",
      "CHECK (\"followerActorType\" IN ('user', 'space', 'organization', 'system') AND \"targetActorType\" IN ('user', 'space', 'organization', 'system'))",
    );
    context.schema.createIndex(
      { ...SOLARA, name: "followers" },
      "idx_followers_target_pair",
      [{ name: "targetActorType" }, { name: "targetActorId" }],
      { ifNotExists: true },
    );

    // 3. Translations: one per post and lang.
    context.schema.addConstraint(
      { ...SOLARA, name: "translations" },
      "translations_post_lang_unique",
      'UNIQUE ("postId", "lang")',
    );
    context.schema.dropIndex("idx_solara_trans_post_lang", SOLARA.schema);

    // 4. Posts: controlled vocabularies + fenced counters.
    context.schema.addConstraint(
      { ...SOLARA, name: "posts" },
      "posts_actor_check",
      "CHECK (\"actorType\" IN ('user', 'space', 'organization', 'system'))",
    );
    context.schema.addConstraint(
      { ...SOLARA, name: "posts" },
      "posts_target_check",
      "CHECK (\"targetType\" IN ('feed', 'space', 'group', 'event'))",
    );
    context.schema.addConstraint(
      { ...SOLARA, name: "posts" },
      "posts_counts_nonnegative",
      'CHECK ("likeCount" >= 0 AND "commentsCount" >= 0)',
    );
    context.schema.createIndex(
      { ...SOLARA, name: "posts" },
      "idx_posts_created_id",
      [
        { name: "createdAt", direction: "desc" },
        { name: "id", direction: "desc" },
      ],
      { ifNotExists: true },
    );

    // 5. Comments: controlled actor + chronological determinism.
    context.schema.addConstraint(
      { ...SOLARA, name: "comments" },
      "comments_actor_check",
      "CHECK (\"actorType\" IN ('user', 'space', 'organization', 'system'))",
    );
    context.schema.dropIndex("idx_solara_comments_post", SOLARA.schema);
    context.schema.createIndex(
      { ...SOLARA, name: "comments" },
      "idx_comments_post_created",
      [{ name: "postId" }, { name: "createdAt" }, { name: "id" }],
      { ifNotExists: true },
    );

    // 6. Long free text to TEXT.
    context.schema.alterColumnType(
      { ...SOLARA, name: "posts" },
      "content",
      "text",
    );
    context.schema.alterColumnType(
      { ...SOLARA, name: "comments" },
      "content",
      "text",
    );
    context.schema.alterColumnType(
      { ...SOLARA, name: "translations" },
      "translatedContent",
      "text",
    );
    context.schema.alterColumnType(
      { ...SOLARA, name: "categories" },
      "description",
      "text",
    );

    // 7. Timestamp defaults (repos keep writing them explicitly).
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "posts" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "comments" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "followers" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "reactions" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "categories" },
      "createdAt",
      func("now"),
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "translations" },
      "createdAt",
      func("now"),
    );
  },
  downMigration: (context: MigrationContext) => {
    // 1. Timestamp defaults.
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "translations" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "categories" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "reactions" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "followers" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "comments" },
      "createdAt",
    );
    context.schema.alterColumnDefault(
      { ...SOLARA, name: "posts" },
      "createdAt",
    );

    // 2. Long free text back to VARCHAR(255).
    context.schema.alterColumnType(
      { ...SOLARA, name: "categories" },
      "description",
      "string",
    );
    context.schema.alterColumnType(
      { ...SOLARA, name: "translations" },
      "translatedContent",
      "string",
    );
    context.schema.alterColumnType(
      { ...SOLARA, name: "comments" },
      "content",
      "string",
    );
    context.schema.alterColumnType(
      { ...SOLARA, name: "posts" },
      "content",
      "string",
    );

    // 3. Indexes and constraints.
    context.schema.dropIndex("idx_comments_post_created", SOLARA.schema);
    context.schema.createIndex(
      { ...SOLARA, name: "comments" },
      "idx_solara_comments_post",
      [{ name: "postId" }],
      { ifNotExists: true },
    );
    context.schema.dropIndex("idx_posts_created_id", SOLARA.schema);
    context.schema.dropConstraint(
      { ...SOLARA, name: "comments" },
      "comments_actor_check",
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "posts" },
      "posts_counts_nonnegative",
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "posts" },
      "posts_target_check",
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "posts" },
      "posts_actor_check",
    );
    context.schema.createIndex(
      { ...SOLARA, name: "translations" },
      "idx_solara_trans_post_lang",
      [{ name: "postId" }, { name: "lang" }],
      { ifNotExists: true },
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "translations" },
      "translations_post_lang_unique",
    );
    context.schema.dropIndex("idx_followers_target_pair", SOLARA.schema);
    context.schema.dropConstraint(
      { ...SOLARA, name: "followers" },
      "followers_actor_check",
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "followers" },
      "followers_no_self_follow",
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "followers" },
      "followers_pair_unique",
    );
    context.schema.createIndex(
      { ...SOLARA, name: "followers" },
      "uniq_solara_followers",
      [{ name: "followerActorId" }, { name: "targetActorId" }],
      { unique: true, ifNotExists: true },
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "reactions" },
      "reactions_actor_check",
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "reactions" },
      "reactions_target_check",
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "reactions" },
      "reactions_type_check",
    );
    context.schema.dropConstraint(
      { ...SOLARA, name: "reactions" },
      "reactions_one_per_actor_target",
    );
  },
};
