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
  DiversityReranker,
  FeedMetricsCollector,
  FeedPost,
  FeedCardContext,
  FeedComponentRenderer,
  FeedStructuredRenderer,
  FeedPostInterceptor,
  GroupedActivityCard,
} from "./index.js";

describe("@mosaix/feed-engine", () => {
  let engine: FeedEngine;

  const dummyContext: FeedCardContext = {
    currentUser: { id: "user_123", roles: ["member"] },
    theme: "dark",
  };

  const dummyPost: FeedPost = {
    id: "post_1",
    actorType: "user",
    actorId: "usr_alice",
    publicationType: "text",
    targetType: "feed",
    targetId: "global",
    content: "Hello MosaiX World!",
    likeCount: 5,
    commentsCount: 2,
    createdAt: new Date("2026-01-01T12:00:00Z"),
  };

  beforeEach(() => {
    engine = new FeedEngine();
    FeedEngineRegistry.clear();
  });

  describe("FeedEngine (Instance)", () => {
    it("should render default card when no renderer is registered", () => {
      const html = engine.renderPost(dummyPost, dummyContext);
      expect(html).toContain("Hello MosaiX World!");
      expect(html).toContain("p-4 rounded-xl");
    });

    it("should register and render with a custom FeedComponentRenderer", () => {
      const customRenderer: FeedComponentRenderer = {
        publicationType: "text",
        render: (p) => `<article class="custom">${p.content}</article>`,
      };

      engine.registerRenderer(customRenderer);
      const html = engine.renderPost(dummyPost, dummyContext);
      expect(html).toBe('<article class="custom">Hello MosaiX World!</article>');
    });

    it("should allow unregistering a renderer", () => {
      const customRenderer: FeedComponentRenderer = {
        publicationType: "text",
        render: (p) => `<article>${p.content}</article>`,
      };

      engine.registerRenderer(customRenderer);
      expect(engine.unregisterRenderer("text")).toBe(true);

      const html = engine.renderPost(dummyPost, dummyContext);
      expect(html).toContain("p-4 rounded-xl");
    });

    it("should register and render structured feed cards", () => {
      const structuredRenderer: FeedStructuredRenderer = {
        publicationType: "text",
        renderStructured: (p) => ({
          id: p.id,
          publicationType: p.publicationType,
          componentName: "TextCard",
          props: { text: p.content },
          fallbackHtml: `<p>${p.content}</p>`,
        }),
      };

      engine.registerStructuredRenderer(structuredRenderer);
      const card = engine.renderStructuredPost(dummyPost, dummyContext);

      expect(card.componentName).toBe("TextCard");
      expect(card.props).toEqual({ text: "Hello MosaiX World!" });
    });

    it("should fall back to default structured card if renderer missing", () => {
      const card = engine.renderStructuredPost(dummyPost, dummyContext);
      expect(card.componentName).toBe("DefaultFeedCard");
      expect(card.fallbackHtml).toContain("Hello MosaiX World!");
    });

    it("should process posts through interceptors in priority order", async () => {
      const interceptor1: FeedPostInterceptor = {
        name: "low-priority-tagger",
        priority: 10,
        canIntercept: () => true,
        intercept: async (p) => ({ ...p, tags: [...(p.tags || []), "p10"] }),
      };

      const interceptor2: FeedPostInterceptor = {
        name: "high-priority-tagger",
        priority: 1,
        canIntercept: () => true,
        intercept: async (p) => ({ ...p, tags: [...(p.tags || []), "p1"] }),
      };

      engine.registerInterceptor(interceptor1);
      engine.registerInterceptor(interceptor2);

      const processed = await engine.processPostsPipeline([dummyPost]);
      expect(processed[0].tags).toEqual(["p1", "p10"]);
    });

    it("should allow batch interceptors", async () => {
      const batchInterceptor: FeedPostInterceptor = {
        name: "batch-highlighter",
        priority: 5,
        canIntercept: () => true,
        intercept: async (p) => p,
        batchIntercept: async (posts) =>
          posts.map((p) => ({ ...p, isPinned: true })),
      };

      engine.registerInterceptor(batchInterceptor);
      const processed = await engine.processPostsPipeline([dummyPost]);
      expect(processed[0].isPinned).toBe(true);
    });

    it("should filter out posts removed or soft-deleted by interceptor", async () => {
      const filterInterceptor: FeedPostInterceptor = {
        priority: 1,
        canIntercept: () => true,
        intercept: async (p) => ({ ...p, isDeleted: true }),
      };

      engine.registerInterceptor(filterInterceptor);
      const processed = await engine.processPostsPipeline([dummyPost]);
      expect(processed).toHaveLength(0);
    });

    it("should clear all registered renderers and interceptors", () => {
      engine.registerRenderer({
        publicationType: "text",
        render: () => "custom",
      });
      engine.clear();

      const html = engine.renderPost(dummyPost, dummyContext);
      expect(html).toContain("Hello MosaiX World!");
    });
  });

  describe("FeedEngineRegistry (Static Proxy)", () => {
    it("should static register and render through default instance", () => {
      FeedEngineRegistry.registerRenderer({
        publicationType: "text",
        render: (p) => `<span>Static ${p.content}</span>`,
      });

      const html = FeedEngineRegistry.renderPost(dummyPost, dummyContext);
      expect(html).toBe("<span>Static Hello MosaiX World!</span>");
    });
  });

  describe("FeedAggregator & ActivityGrouper", () => {
    const postsList: FeedPost[] = [
      {
        id: "p1",
        actorType: "user",
        actorId: "u1",
        publicationType: "text",
        targetType: "space",
        targetId: "sp_tech",
        content: "Space Post 1",
        likeCount: 1,
        commentsCount: 0,
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
      {
        id: "p2",
        actorType: "user",
        actorId: "u2",
        publicationType: "text",
        targetType: "space",
        targetId: "sp_design",
        content: "Space Post 2",
        likeCount: 5,
        commentsCount: 1,
        createdAt: new Date("2026-01-01T12:00:00Z"),
      },
      {
        id: "p3",
        actorType: "user",
        actorId: "u3",
        publicationType: "text",
        targetType: "feed",
        targetId: "global",
        content: "Global Post",
        likeCount: 2,
        commentsCount: 3,
        createdAt: new Date("2026-01-01T11:00:00Z"),
      },
    ];

    it("should aggregate feed and followed spaces using array syntax", () => {
      const res = FeedAggregator.aggregate(postsList, ["sp_tech"]);
      const ids = res.map((r) => r.id);
      expect(ids).toContain("p1");
      expect(ids).toContain("p3");
      expect(ids).not.toContain("p2");
    });

    it("should aggregate followed groups and events with options object", () => {
      const groupPost: FeedPost = {
        ...dummyPost,
        id: "p_grp",
        targetType: "group",
        targetId: "grp_devs",
      };

      const res = FeedAggregator.aggregate([groupPost], {
        followedGroupIds: ["grp_devs"],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("p_grp");
    });

    it("should filter out blocked actors and muted tags", () => {
      const mutedPost: FeedPost = {
        ...dummyPost,
        id: "p_muted",
        tags: ["crypto", "spam"],
      };

      const res = FeedAggregator.aggregate([mutedPost], {
        mutedTags: ["crypto"],
      });

      expect(res).toHaveLength(0);
    });

    it("should keep pinned posts on top regardless of date", () => {
      const unpinnedOlder = postsList[0];
      const pinnedNewer = { ...postsList[1], isPinned: true };

      const res = FeedAggregator.aggregate(
        [unpinnedOlder, pinnedNewer],
        ["sp_tech", "sp_design"],
      );
      expect(res[0].id).toBe("p2");
    });

    it("should group repetitive activities on the same target post", () => {
      const activity1: FeedPost = {
        ...dummyPost,
        id: "act_1",
        activityType: "like",
        parentId: "post_main",
        actorId: "u1",
        createdAt: new Date("2026-01-01T10:00:00Z"),
      };
      const activity2: FeedPost = {
        ...dummyPost,
        id: "act_2",
        activityType: "like",
        parentId: "post_main",
        actorId: "u2",
        createdAt: new Date("2026-01-01T11:00:00Z"),
      };

      const grouped = ActivityGrouper.groupActivities([activity1, activity2]);
      expect(grouped).toHaveLength(1);

      const card = grouped[0] as GroupedActivityCard;
      expect(card.actorCount).toBe(2);
      expect(card.targetPostId).toBe("post_main");
    });

    it("should paginate with aggregatePaginated (Solara contract)", () => {
      const res = FeedAggregator.aggregatePaginated(postsList, ["sp_tech", "sp_design"], {
        limit: 2,
      });

      expect(res.items).toHaveLength(2);
      expect(res.hasMore).toBe(true);
      expect(res.nextCursor).toBeDefined();
    });
  });

  describe("FeedScorer", () => {
    it("should score posts higher for higher engagement and lower age", () => {
      const now = new Date("2026-01-01T12:00:00Z");

      const freshPost: FeedPost = {
        ...dummyPost,
        createdAt: new Date("2026-01-01T11:00:00Z"),
        likeCount: 10,
      };

      const oldPost: FeedPost = {
        ...dummyPost,
        createdAt: new Date("2025-12-01T11:00:00Z"),
        likeCount: 10,
      };

      const scoreFresh = FeedScorer.calculateScore(freshPost, now);
      const scoreOld = FeedScorer.calculateScore(oldPost, now);

      expect(scoreFresh).toBeGreaterThan(scoreOld);
    });
  });

  describe("FeedPaginator", () => {
    it("should correctly encode and decode cursor", () => {
      const date = new Date("2026-01-01T12:00:00Z");
      const id = "post_99";

      const encoded = FeedPaginator.encodeCursor(date, id);
      const decoded = FeedPaginator.decodeCursor(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded?.timestamp).toBe(date.getTime());
      expect(decoded?.id).toBe(id);
    });

    it("should paginate items with limit and generate nextCursor", () => {
      const p1 = { ...dummyPost, id: "p1", createdAt: new Date("2026-01-01T12:00:00Z") };
      const p2 = { ...dummyPost, id: "p2", createdAt: new Date("2026-01-01T11:00:00Z") };
      const p3 = { ...dummyPost, id: "p3", createdAt: new Date("2026-01-01T10:00:00Z") };

      const res = FeedPaginator.paginate([p1, p2, p3], { limit: 2 });
      expect(res.items).toHaveLength(2);
      expect(res.hasMore).toBe(true);
      expect(res.nextCursor).toBeDefined();
    });
  });

  describe("ActivityStreamsMapper", () => {
    it("should convert FeedPost to ActivityStreams 2.0 object", () => {
      const stream = ActivityStreamsMapper.toActivityStream(dummyPost);

      expect(stream["@context"]).toBe("https://www.w3.org/ns/activitystreams");
      expect(stream.id).toBe("urn:mosaix:activity:post_1");
      expect(stream.object.content).toBe("Hello MosaiX World!");
    });

    it("should convert ActivityStreams 2.0 object back to FeedPost", () => {
      const stream = ActivityStreamsMapper.toActivityStream(dummyPost);
      const post = ActivityStreamsMapper.fromActivityStream(stream);

      expect(post.id).toBe("post_1");
      expect(post.content).toBe("Hello MosaiX World!");
      expect(post.actorId).toBe("usr_alice");
    });
  });

  describe("Unified main-side APIs (ranking, safety, federation)", () => {
    it("should rank by engagement with FeedRanker", () => {
      const p1 = { ...dummyPost, id: "p1", likeCount: 1 };
      const p2 = { ...dummyPost, id: "p2", likeCount: 100 };

      const ranked = FeedRanker.rank([p1, p2]);
      expect(ranked[0].id).toBe("p2");
    });

    it("should filter unsafe posts with ContentSafetyFilter", () => {
      const safe = { ...dummyPost, id: "p_safe", content: "Great article about architecture" };
      const unsafe = { ...dummyPost, id: "p_unsafe", content: "Get free money and crypto giveaway click fast" };

      const filtered = ContentSafetyFilter.filterUnsafe([safe, unsafe]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("p_safe");
    });

    it("should resolve registered generator algorithms", () => {
      const algo = FeedGeneratorRegistry.resolve("trending");
      expect(algo).toBeDefined();
      if (algo) {
        const posts = [dummyPost];
        const res = algo(posts, {});
        expect(res).toHaveLength(1);
      }
    });

    it("should convert to/from ActivityPub JSON with the Converter", () => {
      const note = ActivityStreamsConverter.toActivityPubJSON(dummyPost, "mosaix.test");
      expect(note["@context"]).toBe("https://www.w3.org/ns/activitystreams");
      expect(note.id).toBe("https://mosaix.test/posts/post_1");

      const back = ActivityStreamsConverter.fromActivityPubJSON(note);
      expect(back.id).toBe("post_1");
      expect(back.content).toBe("Hello MosaiX World!");
    });

    it("should generate ForYou and trending feeds", () => {
      const p1 = { ...dummyPost, id: "p1", likeCount: 10, targetId: "sp_tech", targetType: "space" as const };
      const p2 = { ...dummyPost, id: "p2", likeCount: 2, targetId: "sp_general", targetType: "space" as const };

      const forYou = ForYouRecommendationEngine.generateForYouFeed([p1, p2], {
        userId: "u_test",
        followedSpaceIds: ["sp_tech"],
      });

      expect(forYou[0].id).toBe("p1");

      const trending = TrendingVelocityRanker.rankByTrending([p1, p2]);
      expect(trending[0].id).toBe("p1");
    });

    it("should inject sponsored posts at interval", () => {
      const organic = [
        { ...dummyPost, id: "o1" },
        { ...dummyPost, id: "o2" },
        { ...dummyPost, id: "o3" },
      ];

      const sponsored: SponsoredPost[] = [
        {
          ...dummyPost,
          id: "sp1",
          isSponsored: true,
          sponsorName: "MosaiX Store",
          campaignId: "cmp_1",
        },
      ];

      const result = SponsoredPostInjector.inject(organic, sponsored, { interval: 2 });
      expect(result).toHaveLength(4);
      expect(result[2].id).toBe("sp1");
    });
  });
});

describe("Périmètre N1 — DiversityReranker & FeedMetricsCollector", () => {
  const samplePosts: FeedPost[] = [
    {
      id: "p-1",
      actorType: "user",
      actorId: "user-1",
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      content: "Post 1 Tech",
      tags: ["tech", "ai"],
      likeCount: 10,
      commentsCount: 2,
      createdAt: new Date(),
    },
    {
      id: "p-2",
      actorType: "user",
      actorId: "user-1",
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      content: "Post 2 Tech",
      tags: ["tech", "ai"],
      likeCount: 9,
      commentsCount: 1,
      createdAt: new Date(),
    },
    {
      id: "p-3",
      actorType: "user",
      actorId: "user-1",
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      content: "Post 3 Tech",
      tags: ["tech"],
      likeCount: 8,
      commentsCount: 0,
      createdAt: new Date(),
    },
    {
      id: "p-4",
      actorType: "user",
      actorId: "user-2",
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      content: "Post 4 Design",
      tags: ["design", "ux"],
      likeCount: 5,
      commentsCount: 1,
      createdAt: new Date(),
    },
    {
      id: "p-5",
      actorType: "user",
      actorId: "user-3",
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      content: "Post 5 Business",
      tags: ["business", "startup"],
      likeCount: 4,
      commentsCount: 2,
      createdAt: new Date(),
    },
  ];

  it("should enforce pure relevance when lambda=1.0 vs maximum diversity when lambda=0.0", () => {
    const pureRelevance = DiversityReranker.rerank(samplePosts, { lambda: 1.0, maxPerAuthor: 5 });
    expect(pureRelevance[0].id).toBe("p-1");

    const maxDiversity = DiversityReranker.rerank(samplePosts, { lambda: 0.0, maxPerAuthor: 5 });
    expect(maxDiversity.map((p) => p.id)).not.toEqual(pureRelevance.map((p) => p.id));
  });

  it("should enforce hard constraints: max per author, max per category, and exclusions", () => {
    const reranked = DiversityReranker.rerank(samplePosts, {
      maxPerAuthor: 2,
      maxPerCategory: 2,
      mutedActorIds: ["user-3"],
      hiddenPostIds: ["p-3"],
    });

    const user1Posts = reranked.filter((p) => p.actorId === "user-1");
    expect(user1Posts.length).toBeLessThanOrEqual(2);
    expect(reranked.some((p) => p.actorId === "user-3")).toBe(false);
    expect(reranked.some((p) => p.id === "p-3")).toBe(false);
  });

  it("should preserve SponsoredPostInjector positioning after MMR reranking", () => {
    const rerankedOrganic = DiversityReranker.rerank(samplePosts, { lambda: 0.7 });
    const sponsoredPool: SponsoredPost[] = [
      {
        id: "sp-1",
        actorType: "organization",
        actorId: "org-1",
        publicationType: "product_showcase",
        targetType: "feed",
        targetId: "global",
        content: "Sponsored",
        likeCount: 0,
        commentsCount: 0,
        createdAt: new Date(),
        isSponsored: true,
        sponsorName: "Sponsor",
        campaignId: "cmp-1",
      },
    ];

    const injected = SponsoredPostInjector.inject(rerankedOrganic, sponsoredPool, { interval: 2 });
    expect(injected.some((p) => (p as SponsoredPost).isSponsored === true)).toBe(true);
  });

  it("should calculate feed telemetry metrics correctly", () => {
    const ir = FeedMetricsCollector.calculateInteractionRate(10, 5, 100);
    expect(ir).toBe(0.15);

    const smr = FeedMetricsCollector.calculateSkipMuteRate(2, 3, 100);
    expect(smr).toBe(0.05);

    const entropy = FeedMetricsCollector.calculateCategoryEntropy(samplePosts);
    expect(entropy).toBeGreaterThan(0);
  });
});
