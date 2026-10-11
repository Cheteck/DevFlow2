import { computeChecksum, type Migration } from "@mosaix/migrations";

/**
 * solara.social.v1.003 — harden social integrity (critique schéma).
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
 * Postgres-only (like v1.001/v1.002).
 */

const upStatements: string[] = [
  // 1. Reactions: one active reaction per actor and target.
  `ALTER TABLE "solara"."reactions" ADD CONSTRAINT "reactions_one_per_actor_target" UNIQUE ("targetType", "targetId", "actorType", "actorId");`,
  `ALTER TABLE "solara"."reactions" ADD CONSTRAINT "reactions_type_check" CHECK ("type" IN ('like', 'love', 'laugh', 'surprised', 'sad', 'angry'));`,
  `ALTER TABLE "solara"."reactions" ADD CONSTRAINT "reactions_target_check" CHECK ("targetType" IN ('post', 'comment'));`,
  `ALTER TABLE "solara"."reactions" ADD CONSTRAINT "reactions_actor_check" CHECK ("actorType" IN ('user', 'space', 'organization', 'system'));`,

  // 2. Followers: full-quad uniqueness + no self-follow.
  // NOTE: v1.001 created uniq_solara_followers as a standalone UNIQUE INDEX
  // (not a table constraint): it must be dropped as an INDEX. Both forms
  // are attempted (IF EXISTS) to stay robust across database histories.
  `ALTER TABLE "solara"."followers" DROP CONSTRAINT IF EXISTS "uniq_solara_followers";`,
  `DROP INDEX IF EXISTS "solara"."uniq_solara_followers";`,
  `ALTER TABLE "solara"."followers" ADD CONSTRAINT "followers_pair_unique" UNIQUE ("followerActorType", "followerActorId", "targetActorType", "targetActorId");`,
  `ALTER TABLE "solara"."followers" ADD CONSTRAINT "followers_no_self_follow" CHECK ("followerActorType" <> "targetActorType" OR "followerActorId" <> "targetActorId");`,
  `ALTER TABLE "solara"."followers" ADD CONSTRAINT "followers_actor_check" CHECK ("followerActorType" IN ('user', 'space', 'organization', 'system') AND "targetActorType" IN ('user', 'space', 'organization', 'system'));`,
  `CREATE INDEX IF NOT EXISTS "idx_followers_target_pair" ON "solara"."followers" ("targetActorType", "targetActorId");`,

  // 3. Translations: one per post and lang.
  `ALTER TABLE "solara"."translations" ADD CONSTRAINT "translations_post_lang_unique" UNIQUE ("postId", "lang");`,
  `DROP INDEX IF EXISTS "solara"."idx_solara_trans_post_lang";`,

  // 4. Posts: controlled vocabularies + fenced counters.
  `ALTER TABLE "solara"."posts" ADD CONSTRAINT "posts_actor_check" CHECK ("actorType" IN ('user', 'space', 'organization', 'system'));`,
  `ALTER TABLE "solara"."posts" ADD CONSTRAINT "posts_target_check" CHECK ("targetType" IN ('feed', 'space', 'group', 'event'));`,
  `ALTER TABLE "solara"."posts" ADD CONSTRAINT "posts_counts_nonnegative" CHECK ("likeCount" >= 0 AND "commentsCount" >= 0);`,
  `CREATE INDEX IF NOT EXISTS "idx_posts_created_id" ON "solara"."posts" ("createdAt" DESC, "id" DESC);`,

  // 5. Comments: controlled actor + chronological determinism.
  `ALTER TABLE "solara"."comments" ADD CONSTRAINT "comments_actor_check" CHECK ("actorType" IN ('user', 'space', 'organization', 'system'));`,
  `DROP INDEX IF EXISTS "solara"."idx_solara_comments_post";`,
  `CREATE INDEX IF NOT EXISTS "idx_comments_post_created" ON "solara"."comments" ("postId", "createdAt", "id");`,

  // 6. Long free text to TEXT.
  `ALTER TABLE "solara"."posts" ALTER COLUMN "content" TYPE TEXT;`,
  `ALTER TABLE "solara"."comments" ALTER COLUMN "content" TYPE TEXT;`,
  `ALTER TABLE "solara"."translations" ALTER COLUMN "translatedContent" TYPE TEXT;`,
  `ALTER TABLE "solara"."categories" ALTER COLUMN "description" TYPE TEXT;`,

  // 7. Timestamp defaults (repos keep writing them explicitly).
  `ALTER TABLE "solara"."posts" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "solara"."comments" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "solara"."followers" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "solara"."reactions" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "solara"."categories" ALTER COLUMN "createdAt" SET DEFAULT now();`,
  `ALTER TABLE "solara"."translations" ALTER COLUMN "createdAt" SET DEFAULT now();`,
];

const downStatements: string[] = [
  `ALTER TABLE "solara"."translations" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "solara"."categories" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "solara"."reactions" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "solara"."followers" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "solara"."comments" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "solara"."posts" ALTER COLUMN "createdAt" DROP DEFAULT;`,
  `ALTER TABLE "solara"."categories" ALTER COLUMN "description" TYPE VARCHAR(255);`,
  `ALTER TABLE "solara"."translations" ALTER COLUMN "translatedContent" TYPE VARCHAR(255);`,
  `ALTER TABLE "solara"."comments" ALTER COLUMN "content" TYPE VARCHAR(255);`,
  `ALTER TABLE "solara"."posts" ALTER COLUMN "content" TYPE VARCHAR(255);`,
  `DROP INDEX IF EXISTS "solara"."idx_comments_post_created";`,
  `CREATE INDEX IF NOT EXISTS "idx_solara_comments_post" ON "solara"."comments" ("postId");`,
  `DROP INDEX IF EXISTS "solara"."idx_posts_created_id";`,
  `ALTER TABLE "solara"."comments" DROP CONSTRAINT IF EXISTS "comments_actor_check";`,
  `ALTER TABLE "solara"."posts" DROP CONSTRAINT IF EXISTS "posts_counts_nonnegative";`,
  `ALTER TABLE "solara"."posts" DROP CONSTRAINT IF EXISTS "posts_target_check";`,
  `ALTER TABLE "solara"."posts" DROP CONSTRAINT IF EXISTS "posts_actor_check";`,
  `CREATE INDEX IF NOT EXISTS "idx_solara_trans_post_lang" ON "solara"."translations" ("postId", "lang");`,
  `ALTER TABLE "solara"."translations" DROP CONSTRAINT IF EXISTS "translations_post_lang_unique";`,
  `DROP INDEX IF EXISTS "solara"."idx_followers_target_pair";`,
  `ALTER TABLE "solara"."followers" DROP CONSTRAINT IF EXISTS "followers_actor_check";`,
  `ALTER TABLE "solara"."followers" DROP CONSTRAINT IF EXISTS "followers_no_self_follow";`,
  `ALTER TABLE "solara"."followers" DROP CONSTRAINT IF EXISTS "followers_pair_unique";`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_solara_followers" ON "solara"."followers" ("followerActorId", "targetActorId");`,
  `ALTER TABLE "solara"."reactions" DROP CONSTRAINT IF EXISTS "reactions_actor_check";`,
  `ALTER TABLE "solara"."reactions" DROP CONSTRAINT IF EXISTS "reactions_target_check";`,
  `ALTER TABLE "solara"."reactions" DROP CONSTRAINT IF EXISTS "reactions_type_check";`,
  `ALTER TABLE "solara"."reactions" DROP CONSTRAINT IF EXISTS "reactions_one_per_actor_target";`,
];

const sqlContent = upStatements.join("\n");
const sqlDown = downStatements.join("\n");

export const migration: Migration = {
  id: "20260926130000_harden_solara",
  content: sqlContent,
  down: sqlDown,
  checksum: computeChecksum(sqlContent),
  resources: [
    "table:solara.reactions",
    "table:solara.followers",
    "table:solara.translations",
    "table:solara.posts",
    "table:solara.comments",
    "table:solara.categories",
  ],
};
