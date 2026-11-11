import { describe, it, expect } from "vitest";
import {
  FeedAggregator,
  registerFeedSortStrategy,
  registerFeedTargetFilter,
  type FeedPost,
  type FeedAggregationOptions,
  type FeedTargetType,
} from "../packages/feed-engine/src/index.js";

describe("Feed Engine Strategy OCP Extensions", () => {
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

  it("allows registering custom target filter strategies for custom targetType without modifying FeedAggregator", () => {
    registerFeedTargetFilter("channel", (post, _options) => {
      return post.targetId === "ch_announcements";
    });

    const posts: FeedPost[] = [
      {
        id: "p1",
        actorType: "user",
        actorId: "u1",
        publicationType: "text",
        targetType: "channel" as FeedTargetType,
        targetId: "ch_announcements",
        content: "Channel msg",
        likeCount: 0,
        commentsCount: 0,
        createdAt: new Date(),
      },
      {
        id: "p2",
        actorType: "user",
        actorId: "u1",
        publicationType: "text",
        targetType: "channel" as FeedTargetType,
        targetId: "ch_random",
        content: "Random msg",
        likeCount: 0,
        commentsCount: 0,
        createdAt: new Date(),
      },
    ];

    const filtered = FeedAggregator.aggregate(posts, {});

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("p1");
  });
});
