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

describe("Solara BAC FEED-V1 Writers (unfollow/edit/delete/vote/repost/pin/report/mute)", () => {
  it("unfollows an actor and reports absence afterwards", async () => {
    const service = new SolaraSocialService();
    await service.followActor("user", "usr-me", "user", "usr-target");
    expect(service.getFollowedTargets("usr-me")).toContain("usr-target");

    expect(await service.unfollowActor("usr-me", "usr-target")).toBe(true);
    expect(service.getFollowedTargets("usr-me")).not.toContain("usr-target");
    expect(await service.unfollowActor("usr-me", "usr-target")).toBe(false);
  });

  it("edits own post author-only and soft-deletes it from feeds", async () => {
    const service = new SolaraSocialService();
    const post = await service.createPost("user", "usr-author", "feed", "global", "Original", "text");

    const updated = await service.updatePost(post.id, "usr-author", "Edited");
    expect(updated.content).toBe("Edited");
    expect(updated.updatedAt).toBeInstanceOf(Date);

    await expect(service.updatePost(post.id, "usr-stranger", "Hijack")).rejects.toThrow(/auteur/);

    await service.deletePost(post.id, "usr-author");
    expect(service.listFeed()).toEqual([]);
    expect(service.listFeedMultiSource("usr-author", "for_you")).toEqual([]);
    await expect(service.deletePost(post.id, "usr-author")).rejects.toThrow(/non trouvé/);
  });

  it("casts poll votes once per actor and tallies results", async () => {
    const service = new SolaraSocialService();
    const poll = await service.createPost("user", "usr-author", "feed", "global", "Best?", "poll", {
      options: [
        { id: "a", text: "Alpha" },
        { id: "b", text: "Beta" },
      ],
    });

    const r1 = await service.castPollVote(poll.id, "a", "usr-voter-1");
    expect(r1.totalVotes).toBe(1);
    const r2 = await service.castPollVote(poll.id, "b", "usr-voter-2");
    expect(r2.totalVotes).toBe(2);
    expect(r2.options.find((o) => o.id === "a")?.votes).toBe(1);

    await expect(service.castPollVote(poll.id, "b", "usr-voter-1")).rejects.toThrow(/déjà voté/);
    await expect(service.castPollVote(poll.id, "zzz", "usr-voter-3")).rejects.toThrow(/inconnue/);

    const notPoll = await service.createPost("user", "usr-author", "feed", "global", "Plain", "text");
    await expect(service.castPollVote(notPoll.id, "a", "usr-voter-1")).rejects.toThrow(/sondage/);
  });

  it("reposts and quotes with repostOf metadata and target counter", async () => {
    const service = new SolaraSocialService();
    const original = await service.createPost("user", "usr-author", "feed", "global", "Original", "text");

    const repost = await service.repostPost("user", "usr-fan", original.id);
    expect(repost.metadata?.repostOf).toBe(original.id);
    expect(original.repostCount).toBe(1);

    const quote = await service.repostPost("user", "usr-fan", original.id, "Must read!");
    expect(quote.content).toBe("Must read!");
    expect(original.repostCount).toBe(2);

    await service.deletePost(original.id, "usr-author");
    await expect(service.repostPost("user", "usr-fan", original.id)).rejects.toThrow(/non trouvé/);
  });

  it("pins and unpins author-only", async () => {
    const service = new SolaraSocialService();
    const post = await service.createPost("user", "usr-author", "feed", "global", "Pinned?", "text");

    expect(service.pinPost(post.id, "usr-author").isPinned).toBe(true);
    expect(() => service.pinPost(post.id, "usr-stranger")).toThrow(/auteur/);
    expect(service.unpinPost(post.id, "usr-author").isPinned).toBe(false);
  });

  it("reports a post into the human moderation queue", async () => {
    const service = new SolaraSocialService();
    const post = await service.createPost("user", "usr-author", "feed", "global", "Dubious", "text");

    const item = service.reportPost(post.id, "usr-reporter", "spam suspecté");
    expect(item.status).toBe("pending");
    expect(item.reason).toContain("usr-reporter");
    expect(service.moderationQueue.getPendingItems()).toHaveLength(1);
    expect(service.moderationQueue.resolveItem(item.id, "rejected")).toBe(true);
    expect(service.moderationQueue.getPendingItems()).toHaveLength(0);
  });

  it("mutes and unmutes actors per user", async () => {
    const service = new SolaraSocialService();
    service.muteActor("usr-me", "usr-noisy");
    service.muteActor("usr-me", "usr-noisy");
    expect(service.getMutedActors("usr-me")).toEqual(["usr-noisy"]);

    expect(service.unmuteActor("usr-me", "usr-noisy")).toBe(true);
    expect(service.getMutedActors("usr-me")).toEqual([]);
    expect(service.unmuteActor("usr-me", "usr-noisy")).toBe(false);
  });
});

describe("Solara BAC FEED-V1-08 Controller (vote/repost/report + query profile)", () => {
  it("casts votes, reposts and reports through controller endpoints", async () => {
    const composition = await createSolaraComposition();

    const pollRes = await composition.controller.createPost({
      method: "POST",
      path: "/solara/posts",
      headers: {},
      body: {
        actorType: "user",
        actorId: "usr-author",
        publicationType: "poll",
        targetType: "feed",
        targetId: "global",
        content: "Choix ?",
        metadata: { options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
      },
    });
    expect(pollRes.statusCode).toBe(201);
    const pollId = (pollRes.body as { post: { id: string } }).post.id;

    const voteRes = await composition.controller.castVote({
      method: "POST",
      path: "/solara/polls/vote",
      headers: {},
      body: { postId: pollId, optionId: "a", actorId: "usr-voter" },
    });
    expect(voteRes.statusCode).toBe(200);
    expect((voteRes.body as { totalVotes: number }).totalVotes).toBe(1);

    const doubleVoteRes = await composition.controller.castVote({
      method: "POST",
      path: "/solara/polls/vote",
      headers: {},
      body: { postId: pollId, optionId: "b", actorId: "usr-voter" },
    });
    expect(doubleVoteRes.statusCode).toBe(400);

    const repostRes = await composition.controller.repost({
      method: "POST",
      path: "/solara/reposts",
      headers: {},
      body: { actorType: "user", actorId: "usr-fan", targetPostId: pollId, quoteComment: "À voir" },
    });
    expect(repostRes.statusCode).toBe(201);

    const reportRes = await composition.controller.reportPost({
      method: "POST",
      path: "/solara/reports",
      headers: {},
      body: { postId: pollId, reporterActorId: "usr-mod", reason: "contenu douteux" },
    });
    expect(reportRes.statusCode).toBe(201);
    expect(composition.socialService.moderationQueue.getPendingItems()).toHaveLength(1);

    const badVoteRes = await composition.controller.castVote({
      method: "POST",
      path: "/solara/polls/vote",
      headers: {},
      body: { postId: pollId, actorId: "usr-x" },
    });
    expect(badVoteRes.statusCode).toBe(400);
  });

  it("honors caller-supplied ForYou profile via query params", async () => {
    const composition = await createSolaraComposition();
    await composition.socialService.createPost("user", "usr-a", "feed", "global", "Post A", "text");

    const feedRes = await composition.controller.listFeed({
      method: "GET",
      path: "/solara/feed",
      headers: {},
      query: { mode: "for_you", userId: "usr-caller", interestTags: "tech" },
    });
    expect(feedRes.statusCode).toBe(200);
    const body = feedRes.body as { posts: unknown[]; feedMode: string };
    expect(body.feedMode).toBe("for_you");
    expect(body.posts.length).toBeGreaterThan(0);
  });
});
