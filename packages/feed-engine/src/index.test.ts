import { describe, it, expect, beforeEach } from "vitest";
import {
  FeedEngine,
  FeedEngineRegistry,
  FeedAggregator,
  ActivityGrouper,
  FeedScorer,
  FeedPaginator,
  ActivityStreamsMapper,
  ActivityStreamsConverter,
  ContentSafetyFilter,
  FeedGeneratorRegistry,
  FeedRanker,
  ForYouRecommendationEngine,
  SponsoredPostInjector,
  SponsoredPost,
  TrendingVelocityRanker,
  FeedPost,
  FeedCardContext,
  FeedComponentRenderer,
  FeedStructuredRenderer,
  FeedPostInterceptor,
  GroupedActivityCard,
} from "./index.js";

describe("@mosaix/feed-engine", () => {
  const sampleContext: FeedCardContext = {
    currentUser: { id: "user_123", roles: ["member"] },
    theme: "dark",
  };

  const createSamplePost = (overrides: Partial<FeedPost> = {}): FeedPost => ({
    id: "post_1",
    actorType: "user",
    actorId: "actor_1",
    publicationType: "text",
    targetType: "feed",
    targetId: "global",
    content: "Hello MosaiX Feed Engine!",
    likeCount: 10,
    commentsCount: 2,
    createdAt: new Date("2026-03-30T10:00:00Z"),
    ...overrides,
  });

  describe("FeedEngine (Instance)", () => {
    let engine: FeedEngine;

    beforeEach(() => {
      engine = new FeedEngine();
    });

    it("should render default card when no renderer is registered", () => {
      const post = createSamplePost({ content: "<script>alert(1)</script>" });
      const html = engine.renderPost(post, sampleContext);

      expect(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe(true);
      expect(html.includes("bg-surface-container-low")).toBe(true);
    });

    it("should register and render with a custom FeedComponentRenderer", () => {
      const renderer: FeedComponentRenderer = {
        publicationType: "text",
        render: (post) => `<custom-post>${post.content}</custom-post>`,
      };

      engine.registerRenderer(renderer);
      const post = createSamplePost();
      const html = engine.renderPost(post, sampleContext);

      expect(html).toBe("<custom-post>Hello MosaiX Feed Engine!</custom-post>");
    });

    it("should allow unregistering a renderer", () => {
      const renderer: FeedComponentRenderer = {
        publicationType: "text",
        render: (post) => `<custom-post>${post.content}</custom-post>`,
      };

      engine.registerRenderer(renderer);
      expect(engine.unregisterRenderer("text")).toBe(true);

      const post = createSamplePost();
      const html = engine.renderPost(post, sampleContext);
      expect(html.includes("<custom-post>")).toBe(false);
    });

    it("should register and render structured feed cards", () => {
      const structuredRenderer: FeedStructuredRenderer = {
        publicationType: "product_showcase",
        renderStructured: (post) => ({
          id: post.id,
          publicationType: post.publicationType,
          componentName: "ProductCard",
          props: { price: 99 },
          fallbackHtml: "<div>Product</div>",
        }),
      };

      engine.registerStructuredRenderer(structuredRenderer);
      const post = createSamplePost({ publicationType: "product_showcase" });

      const card = engine.renderStructuredPost(post, sampleContext);
      expect(card.componentName).toBe("ProductCard");
      expect(card.props.price).toBe(99);
    });

    it("should fall back to default structured card if renderer missing", () => {
      const post = createSamplePost({ publicationType: "unknown_type" });
      const card = engine.renderStructuredPost(post, sampleContext);

      expect(card.componentName).toBe("DefaultFeedCard");
      expect(card.props.post).toEqual(post);
    });

    it("should process posts through interceptors in priority order", async () => {
      const interceptorLowPriority: FeedPostInterceptor = {
        name: "enricher",
        priority: 10,
        canIntercept: () => true,
        intercept: async (post) => ({
          ...post,
          content: post.content + " [Enriched]",
        }),
      };

      const interceptorHighPriority: FeedPostInterceptor = {
        name: "prefixer",
        priority: 1,
        canIntercept: () => true,
        intercept: async (post) => ({
          ...post,
          content: "[Start] " + post.content,
        }),
      };

      engine.registerInterceptor(interceptorLowPriority);
      engine.registerInterceptor(interceptorHighPriority);

      const post = createSamplePost({ content: "Base" });
      const processed = await engine.processPostsPipeline([post]);

      expect(processed[0].content).toBe("[Start] Base [Enriched]");
    });

    it("should allow batch interceptors", async () => {
      const batchInterceptor: FeedPostInterceptor = {
        name: "batch_enricher",
        priority: 5,
        canIntercept: () => true,
        intercept: async (p) => p,
        batchIntercept: async (posts) =>
          posts.map((p) => ({ ...p, likeCount: p.likeCount + 100 })),
      };

      engine.registerInterceptor(batchInterceptor);
      const posts = [
        createSamplePost({ id: "1" }),
        createSamplePost({ id: "2" }),
      ];
      const processed = await engine.processPostsPipeline(posts);

      expect(processed[0].likeCount).toBe(110);
      expect(processed[1].likeCount).toBe(110);
    });

    it("should filter out posts removed or soft-deleted by interceptor", async () => {
      const filterInterceptor: FeedPostInterceptor = {
        priority: 1,
        canIntercept: (p) => p.id === "spam",
        intercept: async () => null,
      };

      engine.registerInterceptor(filterInterceptor);

      const posts = [
        createSamplePost({ id: "valid" }),
        createSamplePost({ id: "spam" }),
      ];

      const processed = await engine.processPostsPipeline(posts);
      expect(processed.length).toBe(1);
      expect(processed[0].id).toBe("valid");
    });

    it("should clear all registered renderers and interceptors", () => {
      engine.registerRenderer({
        publicationType: "text",
        render: () => "custom",
      });
      engine.clear();

      const post = createSamplePost();
      expect(engine.renderPost(post, sampleContext)).not.toBe("custom");
    });
  });

  describe("FeedEngineRegistry (Static Proxy)", () => {
    beforeEach(() => {
      FeedEngineRegistry.clear();
    });

    it("should static register and render through default instance", () => {
      FeedEngineRegistry.registerRenderer({
        publicationType: "system_advisory",
        render: (post) => `[ALERT] ${post.content}`,
      });

      const post = createSamplePost({
        publicationType: "system_advisory",
        content: "Maintenance",
      });
      const html = FeedEngineRegistry.renderPost(post, sampleContext);

      expect(html).toBe("[ALERT] Maintenance");
    });
  });

  describe("FeedAggregator & ActivityGrouper", () => {
    const posts: FeedPost[] = [
      createSamplePost({
        id: "post_feed_1",
        targetType: "feed",
        targetId: "global",
        createdAt: new Date("2026-03-30T10:00:00Z"),
        likeCount: 50,
      }),
      createSamplePost({
        id: "post_space_1",
        targetType: "space",
        targetId: "space_tech",
        createdAt: new Date("2026-03-30T11:00:00Z"),
        likeCount: 10,
      }),
      createSamplePost({
        id: "post_group_1",
        targetType: "group",
        targetId: "group_design",
        createdAt: new Date("2026-03-30T12:00:00Z"),
        likeCount: 100,
      }),
      createSamplePost({
        id: "post_event_1",
        targetType: "event",
        targetId: "event_launch",
        createdAt: new Date("2026-03-30T09:00:00Z"),
        likeCount: 5,
        actorId: "blocked_user",
      }),
    ];

    it("should aggregate feed and followed spaces using array syntax", () => {
      const result = FeedAggregator.aggregate(posts, ["space_tech"]);
      const ids = result.map((p) => p.id);

      expect(ids.includes("post_feed_1")).toBe(true);
      expect(ids.includes("post_space_1")).toBe(true);
      expect(ids.includes("post_group_1")).toBe(false);
    });

    it("should aggregate followed groups and events with options object", () => {
      const result = FeedAggregator.aggregate(posts, {
        followedGroupIds: ["group_design"],
      });
      const ids = result.map((p) => p.id);

      expect(ids.includes("post_feed_1")).toBe(true);
      expect(ids.includes("post_group_1")).toBe(true);
      expect(ids.includes("post_space_1")).toBe(false);
    });

    it("should filter out blocked actors and muted tags", () => {
      const taggedPosts = [
        ...posts,
        createSamplePost({
          id: "post_crypto",
          targetType: "feed",
          tags: ["crypto", "news"],
        }),
      ];

      const result = FeedAggregator.aggregate(taggedPosts, {
        followedEventIds: ["event_launch"],
        blockedActorIds: ["blocked_user"],
        mutedTags: ["crypto"],
      });

      const ids = result.map((p) => p.id);
      expect(ids.includes("post_event_1")).toBe(false);
      expect(ids.includes("post_crypto")).toBe(false);
    });

    it("should keep pinned posts on top regardless of date", () => {
      const pinnedPost = createSamplePost({
        id: "post_pinned",
        targetType: "feed",
        isPinned: true,
        createdAt: new Date("2020-01-01T00:00:00Z"),
      });

      const result = FeedAggregator.aggregate(
        [posts[1], pinnedPost, posts[0]],
        [],
      );
      expect(result[0].id).toBe("post_pinned");
    });

    it("should group repetitive activities on the same target post", () => {
      const like1 = createSamplePost({
        id: "act_like_1",
        activityType: "like",
        parentId: "target_post_100",
        actorId: "usr_1",
        author: { id: "usr_1", name: "Alice" },
      });

      const like2 = createSamplePost({
        id: "act_like_2",
        activityType: "like",
        parentId: "target_post_100",
        actorId: "usr_2",
        author: { id: "usr_2", name: "Bob" },
      });

      const grouped = ActivityGrouper.groupActivities([posts[0], like1, like2]);
      expect(grouped.length).toBe(2);

      const groupCard = grouped.find(
        (g) => "actors" in g,
      ) as GroupedActivityCard;
      expect(groupCard !== undefined).toBe(true);
      expect(groupCard.activityType).toBe("like");
      expect(groupCard.targetPostId).toBe("target_post_100");
      expect(groupCard.actorCount).toBe(2);
    });

    it("should paginate with aggregatePaginated (Solara contract)", () => {
      const page = FeedAggregator.aggregatePaginated(posts, ["space_tech"], {
        limit: 1,
      });
      expect(page.items.length).toBe(1);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBeDefined();
    });
  });

  describe("FeedScorer", () => {
    it("should score posts higher for higher engagement and lower age", () => {
      const now = new Date("2026-03-30T12:00:00Z");
      const freshPost = createSamplePost({
        createdAt: new Date("2026-03-30T11:00:00Z"),
        likeCount: 20,
        commentsCount: 5,
      });

      const oldPost = createSamplePost({
        createdAt: new Date("2026-03-25T10:00:00Z"),
        likeCount: 20,
        commentsCount: 5,
      });

      const scoreFresh = FeedScorer.calculateScore(freshPost, now);
      const scoreOld = FeedScorer.calculateScore(oldPost, now);

      expect(scoreFresh > scoreOld).toBe(true);
    });
  });

  describe("FeedPaginator", () => {
    it("should correctly encode and decode cursor", () => {
      const date = new Date("2026-03-30T10:00:00Z");
      const id = "post_999";

      const cursor = FeedPaginator.encodeCursor(date, id);
      const decoded = FeedPaginator.decodeCursor(cursor);

      expect(decoded).not.toBe(null);
      expect(decoded?.timestamp).toBe(date.getTime());
      expect(decoded?.id).toBe(id);
    });

    it("should paginate items with limit and generate nextCursor", () => {
      const p1 = createSamplePost({
        id: "p1",
        createdAt: new Date("2026-03-30T10:00:00Z"),
      });
      const p2 = createSamplePost({
        id: "p2",
        createdAt: new Date("2026-03-30T09:00:00Z"),
      });
      const p3 = createSamplePost({
        id: "p3",
        createdAt: new Date("2026-03-30T08:00:00Z"),
      });

      const page1 = FeedPaginator.paginate([p1, p2, p3], { limit: 2 });

      expect(page1.items.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor !== undefined).toBe(true);

      const page2 = FeedPaginator.paginate([p1, p2, p3], {
        limit: 2,
        cursor: page1.nextCursor,
      });

      expect(page2.items.length).toBe(1);
      expect(page2.items[0].id).toBe("p3");
      expect(page2.hasMore).toBe(false);
    });
  });

  describe("ActivityStreamsMapper", () => {
    it("should convert FeedPost to ActivityStreams 2.0 object", () => {
      const post = createSamplePost({
        title: "Announcement",
        summary: "Short summary",
        tags: ["announcement", "mosaix"],
        author: {
          id: "usr_42",
          name: "Alice",
          handle: "alice",
          avatarUrl: "https://example.com/avatar.png",
        },
      });

      const asObj = ActivityStreamsMapper.toActivityStream(post);

      expect(asObj["@context"]).toBe("https://www.w3.org/ns/activitystreams");
      expect(asObj.type).toBe("Create");
      expect(asObj.actor.name).toBe("Alice");
      expect(asObj.object.name).toBe("Announcement");
      expect(asObj.object.summary).toBe("Short summary");
      expect(asObj.object.tag).toEqual([
        { type: "Hashtag", name: "announcement" },
        { type: "Hashtag", name: "mosaix" },
      ]);
    });

    it("should convert ActivityStreams 2.0 object back to FeedPost", () => {
      const asObj = {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "urn:mosaix:activity:123",
        type: "Create",
        actor: {
          id: "usr_55",
          type: "Person",
          name: "Bob",
          preferredUsername: "bob",
        },
        object: {
          id: "urn:mosaix:post:123",
          type: "Note",
          content: "Hello Fediverse!",
          name: "My Post",
          published: "2026-03-30T10:00:00.000Z",
        },
        published: "2026-03-30T10:00:00.000Z",
      };

      const post = ActivityStreamsMapper.fromActivityStream(asObj);

      expect(post.id).toBe("123");
      expect(post.author?.name).toBe("Bob");
      expect(post.content).toBe("Hello Fediverse!");
      expect(post.title).toBe("My Post");
    });
  });

  describe("Unified main-side APIs (ranking, safety, federation)", () => {
    it("should rank by engagement with FeedRanker", () => {
      const hot = createSamplePost({
        id: "hot",
        likeCount: 100,
        commentsCount: 20,
      });
      const cold = createSamplePost({
        id: "cold",
        likeCount: 0,
        commentsCount: 0,
      });
      const ranked = FeedRanker.rank([cold, hot], {});
      expect(ranked[0].id).toBe("hot");
    });

    it("should filter unsafe posts with ContentSafetyFilter", () => {
      const posts = [createSamplePost({ id: "ok" })];
      expect(ContentSafetyFilter.filterUnsafe(posts).length).toBe(1);
    });

    it("should resolve registered generator algorithms", () => {
      expect(FeedGeneratorRegistry.resolve("trending")).toBeDefined();
      expect(FeedGeneratorRegistry.resolve("media_only")).toBeDefined();
      expect(FeedGeneratorRegistry.listAvailable().length).toBeGreaterThan(0);
    });

    it("should convert to/from ActivityPub JSON with the Converter", () => {
      const post = createSamplePost({ id: "p1" });
      const note = ActivityStreamsConverter.toActivityPubJSON(
        post,
        "example.com",
      );
      expect(note["@context"]).toBe("https://www.w3.org/ns/activitystreams");
      const back = ActivityStreamsConverter.fromActivityPubJSON(note);
      expect(back.content).toBe(post.content);
    });

    it("should generate ForYou and trending feeds", () => {
      const posts = [
        createSamplePost({ id: "a", likeCount: 5 }),
        createSamplePost({ id: "b", likeCount: 50 }),
      ];
      const profile = { userId: "u1", followedSpaceIds: [] };
      expect(
        ForYouRecommendationEngine.generateForYouFeed(posts, profile).length,
      ).toBe(2);
      expect(TrendingVelocityRanker.rankByTrending(posts).length).toBe(2);
    });

    it("should inject sponsored posts at interval", () => {
      const posts = [
        createSamplePost({ id: "p1" }),
        createSamplePost({ id: "p2" }),
        createSamplePost({ id: "p3" }),
      ];
      const sponsored: SponsoredPost = {
        ...createSamplePost({ id: "s1" }),
        isSponsored: true,
        sponsorName: "Acme",
        campaignId: "camp_1",
      };
      const injected = SponsoredPostInjector.inject(posts, [sponsored], {
        interval: 2,
        maxSponsoredPosts: 1,
      });
      expect(injected.length).toBe(4);
    });
  });
});
