/**
 * @server/routes — feed-routes N1 cutover tests (post shell_feed removal).
 * GET /api/feed serves the Solara pipeline with a stable legacy envelope;
 * POST /api/feed creates a Solara post. No database, no network.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { URL } from "node:url";
import { handleFeedRoutes } from "./feed-routes.js";
import {
  SolaraSocialService,
  resetSharedSocialService,
} from "../../../apps/solara/src/domain/social.model.js";
import type { UserProfile } from "../../shell/profiles.js";

function makeRes() {
  const chunks: string[] = [];
  let status = 0;
  return {
    status: () => status,
    body: () => chunks.join(""),
    json: () => JSON.parse(chunks.join("") || "{}"),
    res: {
      writeHead: (code: number) => {
        status = code;
      },
      end: (data: string) => {
        chunks.push(data);
      },
    } as unknown as import("node:http").ServerResponse,
  };
}

function makeReq(method: string) {
  return {
    method,
    headers: {},
  } as unknown as import("node:http").IncomingMessage;
}

const currentUser = {
  id: "usr-test-1",
  name: "Test User",
  roleLabel: "Membre Standard",
  avatar: "👤",
} as UserProfile;

const backplane = {
  published: [] as Array<{ event: string; payload: unknown }>,
  publish(event: string, payload: unknown) {
    this.published.push({ event, payload });
  },
};

describe("GET /api/feed (Solara N1 pipeline)", () => {
  let service: SolaraSocialService;

  beforeEach(() => {
    resetSharedSocialService();
    service = new SolaraSocialService();
    backplane.published = [];
  });

  it("returns a stable empty envelope when no posts exist (no mocks)", async () => {
    const out = makeRes();
    const handled = await handleFeedRoutes(
      makeReq("GET"),
      out.res,
      new URL("http://localhost/api/feed"),
      currentUser,
      service,
      backplane as never,
    );
    expect(handled).toBe(true);
    expect(out.status()).toBe(200);
    expect(out.json()).toEqual({ posts: [], nextCursor: null, hasMore: false });
  });

  it("serves created posts with legacy display fields", async () => {
    await service.createPost("user", "usr-test-1", "feed", "global", "Hello N1", "text");

    const out = makeRes();
    await handleFeedRoutes(
      makeReq("GET"),
      out.res,
      new URL("http://localhost/api/feed"),
      currentUser,
      service,
      backplane as never,
    );
    const body = out.json();
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0]).toMatchObject({
      authorRole: "Membre",
      authorAvatar: "👤",
      bacSource: "solara",
      content: "Hello N1",
    });
    expect(typeof body.posts[0].likes).toBe("number");
    expect(body.hasMore).toBe(false);
  });

  it("paginates with limit and honors the category filter", async () => {
    await service.createPost("user", "u1", "feed", "global", "Post A", "text");
    await service.createPost("user", "u2", "feed", "global", "Post B", "text");

    const limited = makeRes();
    await handleFeedRoutes(
      makeReq("GET"),
      limited.res,
      new URL("http://localhost/api/feed?limit=1"),
      currentUser,
      service,
      backplane as never,
    );
    const limitedBody = limited.json();
    expect(limitedBody.posts).toHaveLength(1);
    expect(limitedBody.hasMore).toBe(true);
    expect(typeof limitedBody.nextCursor).toBe("number");

    const filtered = makeRes();
    await handleFeedRoutes(
      makeReq("GET"),
      filtered.res,
      new URL("http://localhost/api/feed?category=text"),
      currentUser,
      service,
      backplane as never,
    );
    expect(filtered.json().posts).toHaveLength(2);

    const empty = makeRes();
    await handleFeedRoutes(
      makeReq("GET"),
      empty.res,
      new URL("http://localhost/api/feed?category=no-such-category"),
      currentUser,
      service,
      backplane as never,
    );
    expect(empty.json().posts).toEqual([]);
  });
});

describe("POST /api/feed (Solara createPost)", () => {
  let service: SolaraSocialService;

  beforeEach(() => {
    resetSharedSocialService();
    service = new SolaraSocialService();
    backplane.published = [];
  });

  it("creates a post, publishes the event, and rejects empty content", async () => {
    const { Readable } = await import("node:stream");
    const postReq = Readable.from([JSON.stringify({ content: "Hello via API" })]) as unknown as import("node:http").IncomingMessage;
    (postReq as unknown as Record<string, unknown>).method = "POST";
    (postReq as unknown as Record<string, unknown>).headers = {};

    const created = makeRes();
    const handled = await handleFeedRoutes(
      postReq,
      created.res,
      new URL("http://localhost/api/feed"),
      currentUser,
      service,
      backplane as never,
    );
    expect(handled).toBe(true);
    expect(created.status()).toBe(201);
    const createdBody = created.json();
    expect(createdBody.success).toBe(true);
    expect(createdBody.post.content).toBe("Hello via API");
    expect(createdBody.post.author).toBe("Test User");
    expect(backplane.published).toHaveLength(1);
    expect(backplane.published[0].event).toBe("solara.post.published");
    expect(service.listFeed()).toHaveLength(1);

    // Empty content → 400, nothing persisted, nothing published.
    backplane.published = [];
    const emptyReq = Readable.from([JSON.stringify({ content: "   " })]) as unknown as import("node:http").IncomingMessage;
    (emptyReq as unknown as Record<string, unknown>).method = "POST";
    (emptyReq as unknown as Record<string, unknown>).headers = {};
    const bad = makeRes();
    await handleFeedRoutes(
      emptyReq,
      bad.res,
      new URL("http://localhost/api/feed"),
      currentUser,
      service,
      backplane as never,
    );
    expect(bad.status()).toBe(400);
    expect(backplane.published).toEqual([]);
    expect(service.listFeed()).toHaveLength(1);
  });
});

