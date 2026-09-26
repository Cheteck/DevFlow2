/**
 * @server/routes — Shell Realtime Feed API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { escapeHtml } from "@mosaix/support";
import { feedStore, type FeedPost } from "../../shell/feed-store.js";
import type { FeedService } from "../../shell/feed-service.js";
import type { DistributedEventBackplane } from "../../shell/event-backplane.js";
import type { UserProfile } from "../../shell/profiles.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";

export async function handleFeedRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUser: UserProfile,
  feedService: FeedService,
  eventBackplane: DistributedEventBackplane
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/feed") {
    if (req.method === "POST") {
      try {
        const data = await readLimitedJson<{ content?: string }>(req);
        if (data.content && typeof data.content === "string" && data.content.trim()) {
          const newPost: FeedPost = {
            id: `post-${Date.now()}`,
            author: escapeHtml(currentUser.name),
            authorRole: escapeHtml(currentUser.roleLabel),
            authorAvatar: currentUser.avatar,
            bacSource: "solara",
            content: escapeHtml(data.content.trim()),
            timestamp: "À l'instant",
            likes: 0,
          };
          feedStore.unshift(newPost);
          void feedStore;

          // Persist with FeedService
          await feedService
            .addItem({
              type: "post",
              author: currentUser.name,
              content: data.content.trim(),
              category: "solara",
              likes: 0,
            })
            .catch((err) => { console.warn("[Feed] Persist post error:", err); });

          // Broadcast via distributed event backplane
          eventBackplane.publish("solara.post.published", { post: newPost });

          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, post: newPost }));
          return true;
        }
      } catch {
        // ignore
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Contenu invalide" }));
      return true;
    }

    // Keyset pagination query parsing
    const limit = parseInt(parsedUrl.searchParams.get("limit") || "20", 10);
    const cursor = parsedUrl.searchParams.get("cursor")
      ? parseInt(parsedUrl.searchParams.get("cursor")!, 10)
      : undefined;
    const category = parsedUrl.searchParams.get("category") || undefined;

    let paginated = null; try { paginated = await feedService.getFeed({ limit, cursor, category }); } catch (err) { console.warn("[Feed] Get feed error:", err); }
    if (paginated && paginated.items.length > 0) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          posts: paginated.items.map((i) => ({
            id: i.id,
            author: i.author,
            authorRole: "Membre",
            authorAvatar: "👤",
            bacSource: i.category || "solara",
            content: i.content,
            timestamp: new Date(i.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            likes: i.likes,
          })),
          nextCursor: paginated.nextCursor,
          hasMore: paginated.hasMore,
        })
      );
      return true;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ posts: feedStore, hasMore: false }));
    return true;
  }

  return false;
}
