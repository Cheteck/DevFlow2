/**
 * @mosaix/feed-engine — Shared Extensible Feed & Publication Pipeline
 * Decoupled from any specific BAC, provides ActivityStreams-like structures,
 * component resolvers, render interceptors, and high-performance feed aggregators.
 */

export type SocialActorType = "user" | "space" | "organization" | "system";

export type PublicationType =
  | "text"
  | "media_gallery"
  | "product_showcase"
  | "booking_slot"
  | "system_advisory"
  | string;

export interface FeedPost {
  id: string;
  actorType: SocialActorType;
  actorId: string;
  publicationType: PublicationType;
  targetType: "feed" | "space" | "group" | "event";
  targetId: string;
  content: string;
  mediaUrls?: string[];
  metadata?: Record<string, any>;
  likeCount: number;
  commentsCount: number;
  createdAt: Date;
}

export interface FeedCardContext {
  currentUser: { id: string; roles?: string[] };
  theme?: "light" | "dark" | "high-contrast";
}

/**
 * 1. Component Renderer Interface
 * Registered by third-party BACs to handle customized rendering of specific publication types.
 */
export interface FeedComponentRenderer {
  publicationType: PublicationType;
  render(post: FeedPost, context: FeedCardContext): string;
}

/**
 * 2. Feed Post Interceptor (Middleware Pipeline)
 * Registered by plugins/BACs to asynchronously augment posts before they reach the renderer.
 */
export interface FeedPostInterceptor {
  priority: number; // Execution order: lower executes first
  canIntercept(post: FeedPost): boolean;
  intercept(post: FeedPost): Promise<FeedPost>;
}

/**
 * 3. The Central Decoupled Feed Engine Registry
 */
export class FeedEngineRegistry {
  private static renderers = new Map<string, FeedComponentRenderer>();
  private static interceptors: FeedPostInterceptor[] = [];

  /**
   * Registers an external renderer for a specific publication type.
   */
  public static registerRenderer(renderer: FeedComponentRenderer): void {
    this.renderers.set(renderer.publicationType, renderer);
  }

  /**
   * Registers a post interceptor/middleware.
   */
  public static registerInterceptor(interceptor: FeedPostInterceptor): void {
    this.interceptors.push(interceptor);
    this.interceptors.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Resolves a renderer, falling back to a clean default renderer.
   */
  public static renderPost(post: FeedPost, context: FeedCardContext): string {
    const renderer = this.renderers.get(post.publicationType);
    if (renderer) {
      try {
        return renderer.render(post, context);
      } catch (err) {
        console.error(`[FeedEngine] Renderer failed for type [${post.publicationType}]:`, err);
      }
    }
    return this.renderDefault(post);
  }

  /**
   * Processes a list of posts through all registered interceptors in waterfall sequence.
   */
  public static async processPostsPipeline(posts: FeedPost[]): Promise<FeedPost[]> {
    const processed: FeedPost[] = [];
    for (const post of posts) {
      let currentPost = { ...post };
      for (const interceptor of this.interceptors) {
        if (interceptor.canIntercept(currentPost)) {
          try {
            currentPost = await interceptor.intercept(currentPost);
          } catch (err) {
            console.error(`[FeedEngine] Interceptor error on post [${post.id}]:`, err);
          }
        }
      }
      processed.push(currentPost);
    }
    return processed;
  }

  /**
   * Standard fallback card renderer (Universal styling compliant).
   */
  private static renderDefault(post: FeedPost): string {
    const safeContent = String(post.content || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `
      <div class="p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 text-xs text-on-surface leading-relaxed">
        ${safeContent}
      </div>
    `;
  }
}

/**
 * 4. The Shared Aggregator Utility
 * Merges public feed items and subscribed space items.
 */
export class FeedAggregator {
  /**
   * Combines all available posts, filtering for public feeds and subscribed space contexts.
   */
  public static aggregate(
    allPosts: FeedPost[],
    followedSpaceIds: string[]
  ): FeedPost[] {
    return allPosts
      .filter(post => {
        // A. Public Feed Posts
        if (post.targetType === "feed") return true;

        // B. Posts from followed/subscribed Space contexts
        if (post.targetType === "space" && followedSpaceIds.includes(post.targetId)) {
          return true;
        }

        return false;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
