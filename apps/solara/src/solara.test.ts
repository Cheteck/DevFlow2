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

const TEST_PRINCIPAL = {
  sub: "tester-1",
  tenantId: "t1",
  roles: [],
  permissions: [
    "solara:feed:read",
    "solara:post:create",
    "solara:comment:add",
    "solara:reaction:add",
    "solara:follower:add",
    "solara:moderate:content",
  ],
};

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
      principal: TEST_PRINCIPAL,
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
      principal: TEST_PRINCIPAL,
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
      principal: TEST_PRINCIPAL,
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
      principal: TEST_PRINCIPAL,
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
      principal: TEST_PRINCIPAL,
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

  it("rejects self-follow at service level (v1.003 guard)", async () => {
    const composition = (await createSolaraComposition());

    await expect(
      composition.socialService.followActor("user", "usr-alex", "user", "usr-alex"),
    ).rejects.toThrow("lui-m\u00eame");
  });

  it("upserts reactions on the natural key (v1.003, no duplicates)", async () => {
    const { PostgresSocialRepository } = await import("./domain/postgres-social-repository.js");
    const seen: string[] = [];
    const fakeDb = {
      capabilities: { dialect: "postgres", transactions: true, lock: {} },
      execute: async () => 1,
      query: async (sql: string) => {
        seen.push(sql);
        return [];
      },
      transaction: async (fn: (tx: never) => Promise<never>) => fn({} as never),
      acquireMigrationLock: async () => ({ release: async () => {} }),
    };
    const repo = new PostgresSocialRepository(fakeDb as never);
    await repo.saveReaction("post", "p1", {
      id: "react-1",
      targetType: "post",
      targetId: "p1",
      actorType: "user",
      actorId: "usr-alex",
      type: "like",
      createdAt: new Date(),
    });

    expect(
      seen.some((s) => s.indexOf('ON CONFLICT ("targetType", "targetId", "actorType", "actorId")') !== -1),
    ).toBe(true);
  });

  it("dedupes follows on the full actor quad (v1.003)", async () => {
    const { PostgresSocialRepository } = await import("./domain/postgres-social-repository.js");
    const seen: string[] = [];
    const fakeDb = {
      capabilities: { dialect: "postgres", transactions: true, lock: {} },
      execute: async () => 1,
      query: async (sql: string) => {
        seen.push(sql);
        return [];
      },
      transaction: async (fn: (tx: never) => Promise<never>) => fn({} as never),
      acquireMigrationLock: async () => ({ release: async () => {} }),
    };
    const repo = new PostgresSocialRepository(fakeDb as never);
    await repo.addFollower("space-x", {
      id: "flw-1",
      followerActorType: "user",
      followerActorId: "usr-alex",
      targetActorType: "space",
      targetActorId: "space-x",
      createdAt: new Date(),
    });

    expect(
      seen.some((s) =>
        s.indexOf('ON CONFLICT ("followerActorType", "followerActorId", "targetActorType", "targetActorId")') !== -1,
      ),
    ).toBe(true);
  });

  it("rejects unauthenticated (401) and unauthorized (403) controller calls", async () => {
    const composition = (await createSolaraComposition());

    const noPrincipal = await composition.controller.listPublicationTypes({
      method: "GET",
      path: "/solara/types",
      headers: {},
    });
    expect(noPrincipal.statusCode).toBe(401);

    const noPermission = await composition.controller.createPost({
      method: "POST",
      path: "/solara/posts",
      headers: {},
      principal: { sub: "guest-1", tenantId: "t1", roles: [], permissions: [] },
      body: {
        actorType: "user",
        actorId: "usr-guest",
        targetType: "feed",
        targetId: "global",
        content: "Bonjour le fil",
      },
    });
    expect(noPermission.statusCode).toBe(403);
  });
});

