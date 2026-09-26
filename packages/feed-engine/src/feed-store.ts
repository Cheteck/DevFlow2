import type { FeedPost, FeedReaction, FeedComment, SocialActorType, FeedTargetType } from "./index";

export interface Queryable {
  execute(sql: string, params?: readonly unknown[]): Promise<number>;
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

export class SQLiteFeedStore {
  /**
   * Initializes the feed, reaction, and comment SQL tables with appropriate indexes.
   */
  public static async initSchema(db: Queryable): Promise<void> {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS feed_posts (
        id TEXT PRIMARY KEY,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        publication_type TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        content TEXT NOT NULL,
        media_urls TEXT,
        metadata TEXT,
        like_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_feed_posts_target ON feed_posts (target_type, target_id, created_at DESC);
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS feed_reactions (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(target_id, actor_id, type)
      );
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_feed_reactions_target ON feed_reactions (target_id);
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS feed_comments (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_feed_comments_target ON feed_comments (target_id, created_at ASC);
    `);
  }

  /**
   * Persists a post into SQLite.
   */
  public static async savePost(db: Queryable, post: FeedPost): Promise<void> {
    await db.execute(
      `INSERT OR REPLACE INTO feed_posts 
       (id, actor_type, actor_id, publication_type, target_type, target_id, content, media_urls, metadata, like_count, comments_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        post.id,
        post.actorType,
        post.actorId,
        post.publicationType,
        post.targetType,
        post.targetId,
        post.content,
        post.mediaUrls ? JSON.stringify(post.mediaUrls) : null,
        post.metadata ? JSON.stringify(post.metadata) : null,
        post.likeCount || 0,
        post.commentsCount || 0,
        post.createdAt.toISOString()
      ]
    );
  }

  /**
   * Retrieves posts with pagination.
   */
  public static async getFeedPosts(
    db: Queryable,
    options: { targetSpaceIds?: string[]; limit?: number; beforeCursor?: string } = {}
  ): Promise<FeedPost[]> {
    const limit = options.limit || 20;
    let sql = `SELECT * FROM feed_posts WHERE 1=1`;
    const params: unknown[] = [];

    if (options.targetSpaceIds && options.targetSpaceIds.length > 0) {
      const placeholders = options.targetSpaceIds.map(() => "?").join(",");
      sql += ` AND (target_type = 'feed' OR (target_type = 'space' AND target_id IN (${placeholders})))`;
      params.push(...options.targetSpaceIds);
    } else {
      sql += ` AND target_type = 'feed'`;
    }

    if (options.beforeCursor) {
      sql += ` AND created_at < ?`;
      params.push(options.beforeCursor);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await db.query<Record<string, unknown>>(sql, params);

    return rows.map(row => ({
      id: String(row.id),
      actorType: String(row.actor_type) as SocialActorType,
      actorId: String(row.actor_id),
      publicationType: String(row.publication_type),
      targetType: String(row.target_type) as FeedTargetType,
      targetId: String(row.target_id),
      content: String(row.content),
      mediaUrls: row.media_urls ? JSON.parse(String(row.media_urls)) : undefined,
      metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
      likeCount: Number(row.like_count || 0),
      commentsCount: Number(row.comments_count || 0),
      createdAt: new Date(String(row.created_at))
    }));
  }

  /**
   * Toggles or adds a reaction and updates the like_count on the target post.
   */
  public static async addReaction(db: Queryable, reaction: FeedReaction): Promise<boolean> {
    try {
      await db.execute(
        `INSERT INTO feed_reactions (id, target_type, target_id, actor_type, actor_id, type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          reaction.id,
          reaction.targetType,
          reaction.targetId,
          reaction.actorType,
          reaction.actorId,
          reaction.type,
          reaction.createdAt.toISOString()
        ]
      );

      if (reaction.targetType === "post") {
        await db.execute(`UPDATE feed_posts SET like_count = like_count + 1 WHERE id = ?`, [reaction.targetId]);
      }
      return true;
    } catch {
      // Primary key constraint collision or duplicate reaction
      return false;
    }
  }

  /**
   * Adds a comment and increments comments_count.
   */
  public static async addComment(db: Queryable, comment: FeedComment): Promise<void> {
    await db.execute(
      `INSERT INTO feed_comments (id, target_type, target_id, actor_type, actor_id, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        comment.id,
        comment.targetType,
        comment.targetId,
        comment.actorType,
        comment.actorId,
        comment.content,
        comment.createdAt.toISOString()
      ]
    );

    if (comment.targetType === "post") {
      await db.execute(`UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = ?`, [comment.targetId]);
    }
  }

  /**
   * Retrieves comments for a post.
   */
  public static async getComments(db: Queryable, targetId: string): Promise<FeedComment[]> {
    const rows = await db.query<Record<string, unknown>>(
      `SELECT * FROM feed_comments WHERE target_id = ? ORDER BY created_at ASC`,
      [targetId]
    );

    return rows.map(row => ({
      id: String(row.id),
      targetType: "post",
      targetId: String(row.target_id),
      actorType: String(row.actor_type) as SocialActorType,
      actorId: String(row.actor_id),
      content: String(row.content),
      createdAt: new Date(String(row.created_at))
    }));
  }
}
