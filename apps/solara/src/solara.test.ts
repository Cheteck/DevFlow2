import { SolaraSocialService, postToFeedPost } from "./index.js";
import { describe, expect, it } from "vitest";
import { createSolaraComposition } from "./composition-root";
import { SolaraContentModeratorPlugin } from "@mosaix-plugin/solara-content-moderator";

function registerSolaraAdminPages() {
  return [
    {
      applicationId: "@apps/solara",
      pageId: "social-moderation",
      title: "Modération Solara",
    },
  ];
}

describe("MosaiX Solara Extensible Social Engine Suite", () => {
  it("instantiates Composition Root with Container, Router, and SolaraSocialService", async () => {
    const composition = await createSolaraComposition();

    expect(composition.container).toBeDefined();
    expect(composition.router).toBeDefined();
    expect(composition.socialService).toBeDefined();
    expect(composition.controller).toBeDefined();
  });

  it("lists initial and dynamically registered publication types", async () => {
    const composition = (await createSolaraComposition());

    const typesRes = await composition.controller.listPublicationTypes({
      method: "GET",
      path: "/solara/types",
      headers: {},
    });

    expect(typesRes.statusCode).toBe(200);
    const typesBody = typesRes.body as { publicationTypes: Array<{ type: string; name: string }> };
    expect(typesBody.publicationTypes.length).toBeGreaterThanOrEqual(6);
    expect(typesBody.publicationTypes.some((t) => t.type === "poll")).toBe(true);
    expect(typesBody.publicationTypes.some((t) => t.type === "product_showcase")).toBe(true);
  });

  it("handles polymorphic post creation (Article, Poll, Product Showcase) with metadata validation", async () => {
    const composition = (await createSolaraComposition());

    // 1. Create a Poll publication
    const pollPostRes = await composition.controller.createPost({
      method: "POST",
      path: "/solara/posts",
      headers: {},
      body: {
        actorType: "space",
        actorId: "space-mosaix-tech",
        publicationType: "poll",
        targetType: "feed",
        targetId: "global",
        content: "Quelle fonctionnalité souhaitez-vous voir en priorité ?",
        metadata: {
          options: ["Multi-tenant SSL", "Analytics Avancés", "Paiements Striked"],
        },
      },
    });

    expect(pollPostRes.statusCode).toBe(201);
    const pollPost = (pollPostRes.body as { post: { publicationType: string; metadata: Record<string, unknown> } }).post;
    expect(pollPost.publicationType).toBe("poll");
    expect(pollPost.metadata["options"]).toBeDefined();

    // 2. Reject Poll publication when required metadata field 'options' is missing
    const invalidPollRes = await composition.controller.createPost({
      method: "POST",
      path: "/solara/posts",
      headers: {},
      body: {
        actorType: "space",
        actorId: "space-mosaix-tech",
        publicationType: "poll",
        targetType: "feed",
        targetId: "global",
        content: "Sondage invalide sans options",
      },
    });

    expect(invalidPollRes.statusCode).toBe(400);
    expect((invalidPollRes.body as { error: string }).error).toContain("Métadonnées manquantes");
  });

  it("extrapolates content moderation plugin hooks and rejects profanity", async () => {
    const composition = (await createSolaraComposition());
    const moderatorPlugin = new SolaraContentModeratorPlugin();

    composition.socialService.registerContentHook((content) =>
      moderatorPlugin.moderateContent(content)
    );

    const spamPostRes = await composition.controller.createPost({
      method: "POST",
      path: "/solara/posts",
      headers: {},
      body: {
        actorType: "user",
        actorId: "usr-spammer",
        targetType: "feed",
        targetId: "global",
        content: "Ceci est un SPAM interdit sur la plateforme !",
      },
    });

    expect(spamPostRes.statusCode).toBe(400);
    expect((spamPostRes.body as { error: string }).error).toContain("mot proscrit [spam]");
  });

  it("handles comments and actor-to-actor follow relations", async () => {
    const composition = (await createSolaraComposition());

    const followRes = await composition.controller.followActor({
      method: "POST",
      path: "/solara/followers",
      headers: {},
      body: {
        followerActorType: "user",
        followerActorId: "usr-alex",
        targetActorType: "space",
        targetActorId: "space-bijoux-amel",
      },
    });

    expect(followRes.statusCode).toBe(201);
    const followers = composition.socialService.getFollowers("space", "space-bijoux-amel");
    expect(followers.length).toBe(1);
    expect(followers[0]?.followerActorId).toBe("usr-alex");
  });

  it("exports UI admin page contributions for Imperia and Shell integration", () => {
    const adminPages = registerSolaraAdminPages();
    expect(adminPages.length).toBeGreaterThan(0);
    // Convention repo : MANIFEST.id = "@apps/<app>" (cf. test commerce).
    expect(adminPages[0]?.applicationId).toBe("@apps/solara");
    expect(adminPages[0]?.pageId).toBe("social-moderation");
  });
});

describe("Solara BAC N1 Multi-Source & Adapter", () => {
  it("should aggregate multi-source feeds and deduplicate by post id", async () => {
    const service = new SolaraSocialService();
    const post1 = await service.createPost("user", "usr-1", "feed", "global", "Post 1", "text");
    const post2 = await service.createPost("user", "usr-2", "feed", "global", "Post 2", "text");

    await service.followActor("user", "usr-follower", "user", "usr-1");

    const multiFeed = service.listFeedMultiSource("usr-follower", "for_you");
    expect(multiFeed.length).toBe(2);
    expect(multiFeed.map((p) => p.id)).toContain(post1.id);
    expect(multiFeed.map((p) => p.id)).toContain(post2.id);

    const feedPost = postToFeedPost(post1);
    expect(feedPost.id).toBe(post1.id);
    expect(feedPost.actorId).toBe("usr-1");
  });
});

describe("Solara BAC ForYou Affinity & Outbound Follows", () => {
  it("should correctly resolve outbound followed targets and boost affinity score", async () => {
    const service = new SolaraSocialService();
    await service.followActor("user", "usr-me", "user", "usr-followed-author");

    const followedTargets = service.getFollowedTargets("usr-me");
    expect(followedTargets).toContain("usr-followed-author");

    const followedPost = await service.createPost("user", "usr-followed-author", "feed", "global", "Post by Followed", "text");
    const _strangerPost = await service.createPost("user", "usr-stranger", "feed", "global", "Post by Stranger", "text");

    const multiFeed = service.listFeedMultiSource("usr-me", "for_you");
    expect(multiFeed.length).toBe(2);
    expect(multiFeed[0].id).toBe(followedPost.id);
  });
});

describe("Solara BAC ForYou Affinity Test #2 (Low Velocity Followed vs Viral Stranger)", () => {
  it("should prioritize low-velocity followed author over viral stranger author using deterministic seed", async () => {
    const service = new SolaraSocialService();
    await service.followActor("user", "usr-me", "user", "usr-followed-author");

    // Low velocity followed post
    const lowVelFollowedPost = await service.createPost("user", "usr-followed-author", "feed", "global", "Low velocity followed post", "text");

    // Viral stranger post (100 likes)
    const viralStrangerPost = await service.createPost("user", "usr-stranger", "feed", "global", "Viral stranger post", "text");
    viralStrangerPost.likeCount = 100;

    const multiFeed = service.listFeedMultiSource("usr-me", "for_you");
    expect(multiFeed.length).toBe(2);
    expect(multiFeed[0].id).toBe(lowVelFollowedPost.id);
  });
});
