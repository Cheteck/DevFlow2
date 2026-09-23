/**
 * @apps/solara — PostgreSQL adapter for SolaraSocialService.
 * Implements persistence for posts, comments, and followers.
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

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export class PostgresSocialRepository {
  constructor(private readonly db: DatabasePort) {}

  async savePost(post: Post): Promise<void> {
    await this.db.query(
      `INSERT INTO solara_posts (id, "actorId", "publicationType", data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         data = $4`,
      [post.id, post.actorId, post.publicationType, JSON.stringify(post)],
    );
  }

  async getPost(id: string): Promise<Post | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT data FROM solara_posts WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return null;
    const data = rows[0]?.["data"];
    if (data === undefined) return null;
    return this.hydratePost(data);
  }

  async getPosts(limit = 20): Promise<Post[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT data FROM solara_posts ORDER BY data->>'createdAt' DESC LIMIT $1`,
      [safeLimit],
    );
    return rows
      .map((r) => (r["data"] === undefined ? null : this.hydratePost(r["data"])))
      .filter((p): p is Post => p !== null);
  }

  async saveComment(postId: string, comment: Comment): Promise<void> {
    await this.db.query(
      `INSERT INTO solara_comments (id, "postId", "actorId", content, "createdAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         content = $4`,
      [comment.id, postId, comment.actorId, comment.content, toIso(comment.createdAt)],
    );
  }

  async getComments(postId: string): Promise<Comment[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "postId", "actorId", content, "createdAt" FROM solara_comments WHERE "postId" = $1 ORDER BY "createdAt"`,
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
      `INSERT INTO solara_followers ("followerActorId", "targetActorId", "createdAt")
       VALUES ($1, $2, $3)
       ON CONFLICT ("followerActorId", "targetActorId") DO NOTHING`,
      [follower.followerActorId, targetActorId, toIso(follower.createdAt)],
    );
  }

  async getFollowers(targetActorId: string): Promise<FollowerRelation[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT "followerActorId", "targetActorId", "createdAt" FROM solara_followers WHERE "targetActorId" = $1`,
      [targetActorId],
    );
    return rows.map((r): FollowerRelation => ({
      id: `${asString(r["followerActorId"])}:${asString(r["targetActorId"], targetActorId)}`,
      followerActorType: asString(r["followerActorType"], "user") as FollowerRelation["followerActorType"],
      followerActorId: asString(r["followerActorId"]),
      targetActorType: asString(r["targetActorType"], "user") as FollowerRelation["targetActorType"],
      targetActorId: asString(r["targetActorId"], targetActorId),
      createdAt: new Date(toIso(r["createdAt"])),
    }));
  }

  async saveReaction(postId: string, reaction: SocialReaction): Promise<void> {
    await this.db.query(
      `INSERT INTO solara_reactions (id, "postId", "actorId", type, "createdAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         type = $4`,
      [reaction.id, postId, reaction.actorId, reaction.type, toIso(reaction.createdAt)],
    );
  }

  async getReactions(postId: string): Promise<SocialReaction[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "postId", "actorId", type, "createdAt" FROM solara_reactions WHERE "postId" = $1`,
      [postId],
    );
    return rows.map((r): SocialReaction => ({
      id: asString(r["id"]),
      postId: asString(r["postId"], postId),
      actorId: asString(r["actorId"]),
      type: asString(r["type"]),
      createdAt: new Date(toIso(r["createdAt"])),
    }));
  }

  private hydratePost(data: unknown): Post {
    const raw = typeof data === "string" ? (JSON.parse(data) as Record<string, unknown>) : asRecord(data);
    return {
      id: asString(raw["id"]),
      actorType: asString(raw["actorType"], "user") as Post["actorType"],
      actorId: asString(raw["actorId"]),
      publicationType: asString(raw["publicationType"], "text") as Post["publicationType"],
      targetType: asString(raw["targetType"], "feed") as Post["targetType"],
      targetId: asString(raw["targetId"]),
      content: asString(raw["content"]),
      mediaUrls: raw["mediaUrls"] === undefined ? undefined : asStringArray(raw["mediaUrls"]),
      metadata: raw["metadata"] === undefined ? undefined : asRecord(raw["metadata"]),
      likeCount: typeof raw["likeCount"] === "number" ? raw["likeCount"] : 0,
      commentsCount: typeof raw["commentsCount"] === "number" ? raw["commentsCount"] : 0,
      createdAt: new Date(toIso(raw["createdAt"])),
    };
  }
}
