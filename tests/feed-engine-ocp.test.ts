import { describe, it, expect } from "vitest";
import {
  FeedAggregator,
  registerFeedSortStrategy,
  type FeedPost,
  type FeedAggregationOptions,
} from "../packages/feed-engine/src/index.js";

describe("Feed Engine Sort Strategy OCP Extension", () => {
  it("allows registering custom sort strategies without modifying FeedAggregator.aggregate", () => {
    // Register custom "most_liked" sort strategy
    registerFeedSortStrategy("most_liked", (a: FeedPost, b: FeedPost) => {
      return b.likeCount - a.likeCount;
    });

    const posts: FeedPost[] = [
      {
        id: "p1",
        actorType: "user",
        actorId: "u1",
        publicationType: "text",
        targetType: "feed",
        targetId: "global",
        content: "First",
        likeCount: 5,
        commentsCount: 0,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "p2",
        actorType: "user",
        actorId: "u2",
        publicationType: "text",
        targetType: "feed",
        targetId: "global",
        content: "Second",
        likeCount: 50,
        commentsCount: 0,
        createdAt: new Date("2026-01-02"),
      },
    ];

    const options: FeedAggregationOptions = {
      sortBy: "most_liked" as FeedAggregationOptions["sortBy"],
    };

    const sorted = FeedAggregator.aggregate(posts, options);

    expect(sorted[0].id).toBe("p2");
    expect(sorted[1].id).toBe("p1");
  });
});
