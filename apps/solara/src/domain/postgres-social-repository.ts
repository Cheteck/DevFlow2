/**
 * @apps/solara — PostgreSQL adapter for SolaraSocialService.
 * Implements persistence for posts, comments, followers, and reactions.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { Post, Comment, FollowerRelation, SocialReaction } from "../domain/social.model";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export class PostgresSocialRepository {
  constructor(private readonly db: DatabasePort) {}

  async savePost(post: Post): Promise<void> {
    await this.db.query(
      `INSERT INTO solara_posts (id, "actorId", "actorType", "publicationType", "targetType", "targetId", content, "mediaUrls", metadata, "likeCount", "commentsCount", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         "actorId" = $2,
         "actorType" = $3,
         "publicationType" = $4,
         "targetType" = $5,
         "targetId" = $6,
         content = $7,
         "mediaUrls" = $8,
         metadata = $9,
         "likeCount" = $10,
         "commentsCount" = $11`,
      [
        post.id,
        post.actorId,
        post.actorType,
        post.publicationType,
        post.targetType,
        post.targetId,
        post.content,
        post.mediaUrls ? JSON.stringify(post.mediaUrls) : null,
        post.metadata ? JSON.stringify(post.metadata) : null,
        post.likeCount,
        post.commentsCount,
        toIso(post.createdAt),
      ],
    );
  }

  async getPost(id: string): Promise<Post | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "actorId", "actorType", "publicationType", "targetType", "targetId", content, "mediaUrls", metadata, "likeCount", "commentsCount", "createdAt"
       FROM solara_posts WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return null;
    return this.hydratePost(rows[0]);
  }

  async getPosts(limit = 20): Promise<Post[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "actorId", "actorType", "publicationType", "targetType", "targetId", content, "mediaUrls", metadata, "likeCount", "commentsCount", "createdAt"
       FROM solara_posts ORDER BY "createdAt" DESC LIMIT $1`,
      [safeLimit],
    );
    return rows.map((r) => this.hydratePost(r));
  }

  async saveComment(postId: string, comment: Comment): Promise<void> {
    await this.db.query(
      `INSERT INTO solara_comments (id, "postId", "actorId", "actorType", content, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         content = $5,
         "actorType" = $4`,
      [comment.id, postId, comment.actorId, comment.actorType, comment.content, toIso(comment.createdAt)],
    );
  }

  async getComments(postId: string): Promise<Comment[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "postId", "actorId", "actorType", content, "createdAt" FROM solara_comments WHERE "postId" = $1 ORDER BY "createdAt"`,
      [postId],
    );
    return rows.map((r): Comment => ({
      id: asString(r["id"]),
      postId: asString(r["postId"], postId),
      actorType: asString(r["actorType"], "user") as Comment["actorType"],
      actorId: asString(r["actorId"]),
      content: asString(r["content"]),
      createdAt: new Date(toIso(r["createdAt"])),
    }));
  }

  async addFollower(targetActorId: string, follower: FollowerRelation): Promise<void> {
    await this.db.query(
      `INSERT INTO solara_followers (id, "followerActorId", "followerActorType", "targetActorId", "targetActorType", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("followerActorId", "targetActorId") DO NOTHING`,
      [follower.id, follower.followerActorId, follower.followerActorType, follower.targetActorId, follower.targetActorType, toIso(follower.createdAt)],
    );
  }

  async getFollowers(targetActorId: string): Promise<FollowerRelation[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "followerActorId", "followerActorType", "targetActorId", "targetActorType", "createdAt" FROM solara_followers WHERE "targetActorId" = $1`,
      [targetActorId],
    );
    return rows.map((r): FollowerRelation => ({
      id: asString(r["id"]),
      followerActorType: asString(r["followerActorType"], "user") as FollowerRelation["followerActorType"],
      followerActorId: asString(r["followerActorId"]),
      targetActorType: asString(r["targetActorType"], "user") as FollowerRelation["targetActorType"],
      targetActorId: asString(r["targetActorId"], targetActorId),
      createdAt: new Date(toIso(r["createdAt"])),
    }));
  }

  async saveReaction(targetType: "post" | "comment", targetId: string, reaction: SocialReaction): Promise<void> {
    await this.db.query(
      `INSERT INTO solara_reactions (id, "targetType", "targetId", "actorId", "actorType", type, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         type = $6,
         "actorType" = $5`,
      [reaction.id, targetType, targetId, reaction.actorId, reaction.actorType ?? "user", reaction.type, toIso(reaction.createdAt)],
    );
  }

  async getReactions(targetType: "post" | "comment", targetId: string): Promise<SocialReaction[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "targetType", "targetId", "actorId", "actorType", type, "createdAt" FROM solara_reactions WHERE "targetType" = $1 AND "targetId" = $2`,
      [targetType, targetId],
    );
    return rows.map((r): SocialReaction => ({
      id: asString(r["id"]),
      targetType: asString(r["targetType"]) as "post" | "comment",
      targetId: asString(r["targetId"]),
      actorId: asString(r["actorId"]),
      actorType: asString(r["actorType"], "user") as SocialReaction["actorType"],
      type: asString(r["type"]),
      createdAt: new Date(toIso(r["createdAt"])),
    }));
  }

  async incrementLikeCount(postId: string, delta: number): Promise<void> {
    await this.db.query(
      `UPDATE solara_posts SET "likeCount" = "likeCount" + $1 WHERE id = $2`,
      [delta, postId],
    );
  }

  async incrementCommentsCount(postId: string, delta: number): Promise<void> {
    await this.db.query(
      `UPDATE solara_posts SET "commentsCount" = "commentsCount" + $1 WHERE id = $2`,
      [delta, postId],
    );
  }

  private hydratePost(raw: Record<string, unknown>): Post {
    return {
      id: asString(raw["id"]),
      actorType: asString(raw["actorType"], "user") as Post["actorType"],
      actorId: asString(raw["actorId"]),
      publicationType: asString(raw["publicationType"], "text") as Post["publicationType"],
      targetType: asString(raw["targetType"], "feed") as Post["targetType"],
      targetId: asString(raw["targetId"]),
      content: asString(raw["content"]),
      mediaUrls: raw["mediaUrls"] === undefined || raw["mediaUrls"] === null ? undefined : asStringArray(raw["mediaUrls"]),
      metadata: raw["metadata"] === undefined || raw["metadata"] === null ? undefined : asRecord(raw["metadata"]),
      likeCount: asNumber(raw["likeCount"]),
      commentsCount: asNumber(raw["commentsCount"]),
      createdAt: new Date(toIso(raw["createdAt"])),
    };
  }
}