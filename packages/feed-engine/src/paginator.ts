/**
 * @mosaix/feed-engine — Cursor Pagination
 */

import type { FeedPost, PaginationOptions, PaginatedFeedResult } from "./types.js";

export class FeedPaginator {
  public static encodeCursor(date: Date, id: string): string {
    const raw = `${date.getTime()}:${id}`;
    if (typeof Buffer !== "undefined") {
      return Buffer.from(raw).toString("base64url");
    }
    return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  public static decodeCursor(
    cursor: string,
  ): { timestamp: number; id: string } | null {
    try {
      let raw = "";
      if (typeof Buffer !== "undefined") {
        raw = Buffer.from(cursor, "base64url").toString("utf-8");
      } else {
        const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
        raw = atob(base64);
      }
      const [tsStr, id] = raw.split(":");
      const timestamp = parseInt(tsStr, 10);
      if (isNaN(timestamp) || !id) return null;
      return { timestamp, id };
    } catch {
      return null;
    }
  }

  public static paginate(
    posts: FeedPost[],
    options: PaginationOptions = {},
  ): PaginatedFeedResult {
    const limit = Math.max(1, options.limit || 20);
    let filteredPosts = [...posts];

    if (options.cursor) {
      const cursorData = this.decodeCursor(options.cursor);
      if (cursorData) {
        filteredPosts = filteredPosts.filter((p) => {
          const pTs = p.createdAt.getTime();
          if (pTs < cursorData.timestamp) return true;
          if (pTs === cursorData.timestamp) return p.id < cursorData.id;
          return false;
        });
      }
    }

    const items = filteredPosts.slice(0, limit);
    const hasMore = filteredPosts.length > limit;

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = this.encodeCursor(lastItem.createdAt, lastItem.id);
    }

    return {
      items,
      hasMore,
      nextCursor,
      totalCount: posts.length,
    };
  }
}
