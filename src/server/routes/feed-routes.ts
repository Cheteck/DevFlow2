/**
 * @server/routes — Solara-backed Realtime Feed API Routes.
 *
 * Post `shell_feed` removal: GET /api/feed serves the Solara N1 pipeline
 * (multi-source fusion → ForYou recommendation + MMR diversity), POST /api/feed
 * creates a Solara post. The JSON envelope stays compatible with the legacy
 * shell_feed API: `{ posts: [...], nextCursor, hasMore }`.
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { escapeHtml } from "@mosaix/support";
import type { DistributedEventBackplane } from "../../shell/event-backplane.js";
import type { UserProfile } from "../../shell/profiles.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";
import {
  FeedMetricsCollector,
  ForYouRecommendationEngine,
  type FeedPost,
} from "@mosaix/feed-engine";
import {
  postToFeedPost,
  type SolaraSocialService,
} from "../../../apps/solara/src/domain/social.model.js";

interface DisplayPost {
  id: string;
  author: string;
  authorRole: string;
  authorAvatar: string;
  bacSource: string;
  content: string;
  timestamp: string;
  likes: number;
}

function toDisplayPost(post: FeedPost, authorLabel?: string): DisplayPost {
  return {
    id: post.id,
    author: authorLabel ?? post.actorId,
    authorRole: "Membre",
    authorAvatar: "👤",
    bacSource: "solara",
    content: post.content,
    timestamp: post.createdAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    likes: post.likeCount,
  };
}

type FeedMode = "for_you" | "trending" | "chronological";

function parseMode(raw: string | null): FeedMode {
  return raw === "trending" || raw === "chronological" || raw === "for_you"
    ? raw
    : "for_you";
}

export async function handleFeedRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUser: UserProfile,
  socialService: SolaraSocialService,
  eventBackplane: DistributedEventBackplane
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/feed") {
    if (req.method === "POST") {
      try {
        const data = await readLimitedJson<{ content?: string }>(req);
        if (data.content && typeof data.content === "string" && data.content.trim()) {
          const post = await socialService.createPost(
            "user",
            currentUser.id,
            "feed",
            "global",
            data.content.trim(),
            "text",
          );

          const displayPost: DisplayPost = {
            ...toDisplayPost(postToFeedPost(post)),
            author: escapeHtml(currentUser.name),
            authorRole: escapeHtml(currentUser.roleLabel),
            authorAvatar: currentUser.avatar,
            timestamp: "À l'instant",
          };

          // Broadcast via distributed event backplane
          eventBackplane.publish("solara.post.published", { post: displayPost });

          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, post: displayPost }));
          return true;
        }
      } catch {
        // ignore → 400 below (validation / moderation rejection)
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Contenu invalide" }));
      return true;
    }

    // Keyset & mode pagination query parsing
    const rawLimit = parseInt(parsedUrl.searchParams.get("limit") || "20", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 20 : rawLimit, 1), 100);
    const cursor = parsedUrl.searchParams.get("cursor")
      ? parseInt(parsedUrl.searchParams.get("cursor")!, 10)
      : undefined;
    const category = parsedUrl.searchParams.get("category") || undefined;
    const mode = parseMode(parsedUrl.searchParams.get("mode"));

    try {
      // 1. Multi-source fusion (hydrated from Postgres when wired)
      const solaraPosts = await socialService.listFeedMultiSourceAsync(
        currentUser.id,
        mode,
      );
      let feedPosts = solaraPosts.map(postToFeedPost);

      // 2. Personalized ranking for for_you (trending/chronological come pre-sorted)
      if (mode === "for_you") {
        feedPosts = ForYouRecommendationEngine.generateForYouFeed(feedPosts, {
          userId: currentUser.id,
          followedSpaceIds: socialService.getFollowedTargets(currentUser.id),
        });
      }

      // 3. Legacy category filter (publication type or tag match)
      if (category && category !== "all") {
        feedPosts = feedPosts.filter(
          (p) => p.publicationType === category || (p.tags || []).includes(category),
        );
      }

      // 4. Timestamp cursor (best-effort on ranked order) + limit+1 pagination
      const windowed = cursor
        ? feedPosts.filter((p) => p.createdAt.getTime() < cursor)
        : feedPosts;
      const hasMore = windowed.length > limit;
      const page = hasMore ? windowed.slice(0, limit) : windowed;
      const nextCursor =
        hasMore && page.length > 0 ? page[page.length - 1].createdAt.getTime() : null;

      FeedMetricsCollector.recordImpression(page.length);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          posts: page.map((p) => toDisplayPost(p)),
          nextCursor,
          hasMore,
        })
      );
      return true;
    } catch (err) {
      console.warn("[Feed] Get feed error:", err);
    }

    // Empty feed (demo or not): no mock content is ever served —
    // matches the DEMO-OFF doctrine (empty database → empty feed).
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ posts: [], nextCursor: null, hasMore: false }));
    return true;
  }

  return false;
}
