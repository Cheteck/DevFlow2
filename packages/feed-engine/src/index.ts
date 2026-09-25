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
 * Trait 1: Feedable
 * Implemented by domain entities to declare their ability to project themselves into a feed.
 */
export interface FeedProjection {
  publicationType: PublicationType;
  authorActorType: SocialActorType;
  authorActorId: string;
  summaryText: string;
  targetSpaceId?: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Feedable {
  readonly isFeedable: true;
  toFeedProjection(): FeedProjection;
}

/**
 * Type Guard for Feedable trait
 */
export function isFeedable(entity: unknown): entity is Feedable {
  return (
    typeof entity === "object" &&
    entity !== null &&
    (entity as Feedable).isFeedable === true &&
    typeof (entity as Feedable).toFeedProjection === "function"
  );
}

/**
 * Trait 2: Engageable
 * Implemented by entities to declare social engagement rules (reactions, comments).
 */
export type ReactionType = "like" | "love" | "laugh" | "surprised" | "sad" | "angry";

export interface EngagementPolicy {
  allowReactions: boolean;
  allowedReactionTypes?: ReactionType[];
  allowComments: boolean;
  requireModeration?: boolean;
}

export interface Engageable {
  readonly isEngageable: true;
  readonly targetId: string;
  readonly targetType: "post" | "comment" | "custom";
  getEngagementPolicy?(): EngagementPolicy;
}

/**
 * Type Guard for Engageable trait
 */
export function isEngageable(entity: unknown): entity is Engageable {
  return (
    typeof entity === "object" &&
    entity !== null &&
    (entity as Engageable).isEngageable === true &&
    typeof (entity as Engageable).targetId === "string"
  );
}

/**
 * Reaction & Comment Data Contracts
 */
export interface FeedReaction {
  id: string;
  targetType: "post" | "comment" | "custom";
  targetId: string;
  actorType: SocialActorType;
  actorId: string;
  type: ReactionType;
  createdAt: Date;
}

export interface FeedComment {
  id: string;
  targetType: "post";
  targetId: string;
  actorType: SocialActorType;
  actorId: string;
  content: string;
  createdAt: Date;
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
 * 4. The Shared Aggregator Utility with Cursor Pagination support
 * Merges public feed items and subscribed space items with cursor-based pagination.
 */
export interface PaginatedFeedOptions {
  limit?: number;
  afterCursor?: string; // ISO date or Post ID
  beforeCursor?: string;
}

export interface PaginatedFeedResult {
  items: FeedPost[];
  hasMore: boolean;
  nextCursor?: string;
}

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

  /**
   * Aggregates and returns a paginated slice of posts.
   */
  public static aggregatePaginated(
    allPosts: FeedPost[],
    followedSpaceIds: string[],
    options: PaginatedFeedOptions = {}
  ): PaginatedFeedResult {
    const sorted = this.aggregate(allPosts, followedSpaceIds);
    const limit = options.limit && options.limit > 0 ? options.limit : 20;

    let filtered = sorted;
    if (options.afterCursor) {
      const cursorTime = new Date(options.afterCursor).getTime();
      if (!isNaN(cursorTime)) {
        filtered = filtered.filter(p => p.createdAt.getTime() < cursorTime);
      }
    }

    const items = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const lastItem = items[items.length - 1];
    const nextCursor = lastItem ? lastItem.createdAt.toISOString() : undefined;

    return {
      items,
      hasMore,
      nextCursor
    };
  }
}

/**
 * 5. W3C ActivityStreams / ActivityPub Converter Utility
 * Enables interop and federation between MosaiX instances.
 */
export interface ActivityStreamsNote {
  "@context": "https://www.w3.org/ns/activitystreams";
  id: string;
  type: "Note" | "Article" | "Create";
  attributedTo: string;
  content: string;
  published: string;
  attachment?: Array<{ type: "Link" | "Image"; href: string }>;
  likeCount?: number;
}

export class ActivityStreamsConverter {
  /**
   * Converts a FeedPost to W3C ActivityStreams format
   */
  public static toActivityPubJSON(post: FeedPost, instanceDomain = "mosaix.local"): ActivityStreamsNote {
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `https://${instanceDomain}/posts/${post.id}`,
      type: "Note",
      attributedTo: `https://${instanceDomain}/actors/${post.actorType}/${post.actorId}`,
      content: post.content,
      published: post.createdAt.toISOString(),
      attachment: post.mediaUrls?.map(url => ({
        type: "Image",
        href: url
      })),
      likeCount: post.likeCount
    };
  }

  /**
   * Converts an ActivityStreams note to a FeedPost
   */
  public static fromActivityPubJSON(note: ActivityStreamsNote): FeedPost {
    const matchActor = note.attributedTo.match(/actors\/([^/]+)\/([^/]+)$/);
    const actorType = (matchActor ? matchActor[1] : "user") as SocialActorType;
    const actorId = matchActor ? matchActor[2] : note.attributedTo;

    return {
      id: note.id.split("/").pop() || note.id,
      actorType,
      actorId,
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      content: note.content,
      mediaUrls: note.attachment?.map(att => att.href),
      likeCount: note.likeCount || 0,
      commentsCount: 0,
      createdAt: new Date(note.published)
    };
  }
}

/**
 * 6. Sponsored / Promoted Publications Contract
 */
export interface SponsoredPost extends FeedPost {
  isSponsored: true;
  sponsorName: string;
  sponsorBadge?: string; // e.g., "Sponsorisé", "Sponsorisé par MosaiX"
  ctaText?: string;     // e.g., "Découvrir l'offre", "Réserver un créneau"
  ctaUrl?: string;
  campaignId: string;
}

/**
 * Type Guard for SponsoredPost
 */
export function isSponsoredPost(post: unknown): post is SponsoredPost {
  return (
    typeof post === "object" &&
    post !== null &&
    (post as SponsoredPost).isSponsored === true &&
    typeof (post as SponsoredPost).campaignId === "string"
  );
}

/**
 * 7. Algorithmic Feed Ranking & Scoring Engine
 */
export interface FeedRankingWeights {
  recencyWeight?: number;       // default: 0.4
  engagementWeight?: number;    // default: 0.3
  affinityWeight?: number;      // default: 0.3
  timeDecayHalfLifeHours?: number; // default: 24h
}

export interface FeedRankingContext {
  currentUserFollowedSpaces?: string[];
  weights?: FeedRankingWeights;
}

export class FeedRanker {
  /**
   * Computes a relevance score for a FeedPost given ranking weights and user context.
   */
  public static calculateScore(post: FeedPost, context: FeedRankingContext = {}): number {
    const weights = {
      recencyWeight: context.weights?.recencyWeight ?? 0.4,
      engagementWeight: context.weights?.engagementWeight ?? 0.3,
      affinityWeight: context.weights?.affinityWeight ?? 0.3,
      timeDecayHalfLifeHours: context.weights?.timeDecayHalfLifeHours ?? 24
    };

    // A. Recency Decay (exponential decay)
    const ageInHours = Math.max(0, (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60));
    const recencyScore = Math.pow(0.5, ageInHours / weights.timeDecayHalfLifeHours);

    // B. Engagement Score (logarithmic scaling for reactions and comments)
    const totalEngagements = (post.likeCount || 0) * 1 + (post.commentsCount || 0) * 2;
    const engagementScore = Math.min(1, Math.log10(totalEngagements + 1) / 3);

    // C. Affinity Score
    const isFollowedSpace = context.currentUserFollowedSpaces?.includes(post.targetId) ?? false;
    const affinityScore = isFollowedSpace ? 1.0 : 0.2;

    return (
      recencyScore * weights.recencyWeight +
      engagementScore * weights.engagementWeight +
      affinityScore * weights.affinityWeight
    );
  }

  /**
   * Ranks an array of feed posts dynamically based on calculated score.
   */
  public static rank(posts: FeedPost[], context: FeedRankingContext = {}): FeedPost[] {
    return [...posts].sort((a, b) => this.calculateScore(b, context) - this.calculateScore(a, context));
  }
}

/**
 * 8. Sponsored Publications Injection Engine
 */
export interface SponsorshipInjectionOptions {
  interval?: number;          // insert 1 sponsored post every N organic posts (default: 5)
  maxSponsoredPosts?: number; // max sponsored posts per feed view (default: 3)
}

export class SponsoredPostInjector {
  /**
   * Interjects sponsored publications into organic feeds at configured intervals.
   */
  public static inject(
    organicPosts: FeedPost[],
    sponsoredPool: SponsoredPost[],
    options: SponsorshipInjectionOptions = {}
  ): FeedPost[] {
    if (!sponsoredPool || sponsoredPool.length === 0) return organicPosts;

    const interval = options.interval && options.interval > 0 ? options.interval : 5;
    const maxSponsored = options.maxSponsoredPosts ?? 3;

    const result: FeedPost[] = [];
    let sponsoredInserted = 0;
    let organicCounter = 0;

    for (const post of organicPosts) {
      result.push(post);
      organicCounter++;

      if (
        organicCounter % interval === 0 &&
        sponsoredInserted < maxSponsored &&
        sponsoredInserted < sponsoredPool.length
      ) {
        result.push(sponsoredPool[sponsoredInserted]);
        sponsoredInserted++;
      }
    }

    return result;
  }
}

/**
 * 9. "Pour Toi" (For You) Personalized Recommendation Engine
 */
export interface UserRecommendationProfile {
  userId: string;
  followedSpaceIds: string[];
  interestTags?: string[];
  mutedActorIds?: string[];
  hiddenPostIds?: string[];
}

export class ForYouRecommendationEngine {
  /**
   * Generates a personalized "Pour Toi" feed with interest tag matching,
   * serendipity discovery boosting, and noise exclusion (muted actors / hidden posts).
   */
  public static generateForYouFeed(
    allPosts: FeedPost[],
    profile: UserRecommendationProfile,
    options: { weights?: FeedRankingWeights } = {}
  ): FeedPost[] {
    // A. Filter out muted actors & hidden posts
    const mutedSet = new Set(profile.mutedActorIds || []);
    const hiddenSet = new Set(profile.hiddenPostIds || []);

    const eligiblePosts = allPosts.filter(post => {
      if (mutedSet.has(post.actorId)) return false;
      if (hiddenSet.has(post.id)) return false;
      return true;
    });

    // B. Calculate personalized recommendation score
    const scoredPosts = eligiblePosts.map(post => {
      // Base algorithmic ranking score
      const baseScore = FeedRanker.calculateScore(post, {
        currentUserFollowedSpaces: profile.followedSpaceIds,
        weights: options.weights
      });

      // Interest tag match bonus
      let interestBonus = 0;
      if (profile.interestTags && profile.interestTags.length > 0 && post.metadata?.tags) {
        const postTags = Array.isArray(post.metadata.tags) ? post.metadata.tags : [];
        const matchingTags = postTags.filter(tag => profile.interestTags!.includes(String(tag)));
        interestBonus = matchingTags.length * 0.25;
      }

      // Serendipity bonus for highly engaging trending posts outside followed spaces
      const isUnfollowedSpace = !profile.followedSpaceIds.includes(post.targetId) && post.targetType === "space";
      const isTrending = (post.likeCount + post.commentsCount) >= 5;
      const serendipityBonus = (isUnfollowedSpace && isTrending) ? 0.2 : 0;

      return {
        post,
        finalScore: baseScore + interestBonus + serendipityBonus
      };
    });

    // C. Sort descending by final recommendation score
    scoredPosts.sort((a, b) => b.finalScore - a.finalScore);

    return scoredPosts.map(item => item.post);
  }
}

/**
 * 10. Trending & Viral Velocity Algorithm (Inspired by HackerNews / Reddit / Phoenix)
 * Velocity = (Engagements) / (Age + 2)^gravity
 */
export class TrendingVelocityRanker {
  public static calculateVelocity(post: FeedPost, gravity = 1.6): number {
    const ageInHours = Math.max(0, (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60));
    const rawEngagements = (post.likeCount || 0) * 2 + (post.commentsCount || 0) * 4;
    return rawEngagements / Math.pow(ageInHours + 2, gravity);
  }

  public static rankByTrending(posts: FeedPost[], gravity = 1.6): FeedPost[] {
    return [...posts].sort((a, b) => this.calculateVelocity(b, gravity) - this.calculateVelocity(a, gravity));
  }
}

/**
 * 11. Content Safety & Quality Moderation Engine
 * Evaluates spam, abusive patterns, repetition, and assigns a quality score.
 */
export interface QualityReport {
  score: number; // 0.0 to 1.0 (1.0 is pristine quality)
  isSafe: boolean;
  flags: string[];
}

export class ContentSafetyFilter {
  private static SPAM_KEYWORDS = [
    "viagra", "crypto giveaway", "free money", "gagnez 10000€", "double your coins",
    "whatsapp me", "click here fast", "earn from home fast"
  ];

  public static evaluate(post: FeedPost): QualityReport {
    const flags: string[] = [];
    let penalty = 0;
    const content = (post.content || "").toLowerCase();

    // 1. Spam keyword analysis
    for (const kw of this.SPAM_KEYWORDS) {
      if (content.includes(kw)) {
        flags.push(`spam_keyword:${kw}`);
        penalty += 0.4;
      }
    }

    // 2. Character repetition check (e.g. "aaaaaaa!!!!")
    if (/(.)\1{5,}/.test(content)) {
      flags.push("excessive_character_repetition");
      penalty += 0.2;
    }

    // 3. Excessive uppercase check
    const uppercaseCount = (post.content.match(/[A-Z]/g) || []).length;
    if (post.content.length > 20 && uppercaseCount / post.content.length > 0.6) {
      flags.push("excessive_caps");
      penalty += 0.15;
    }

    // 4. Short / Low Effort content
    if (post.content.trim().length < 5 && (!post.mediaUrls || post.mediaUrls.length === 0)) {
      flags.push("low_effort");
      penalty += 0.1;
    }

    const score = Math.max(0, Math.min(1, 1.0 - penalty));
    const isSafe = score >= 0.5 && !flags.some(f => f.startsWith("spam_keyword"));

    return { score, isSafe, flags };
  }

  public static filterUnsafe(posts: FeedPost[]): FeedPost[] {
    return posts.filter(post => this.evaluate(post).isSafe);
  }
}

/**
 * 12. Sponsored Ads Telemetry & Impression Tracker
 * High-precision attribution for impressions, clicks, and CTR calculation.
 */
export interface AdTelemetryEvent {
  campaignId: string;
  postId: string;
  viewerActorId: string;
  eventType: "impression" | "click" | "cta_conversion";
  timestamp: Date;
}

export class SponsorshipTelemetry {
  private static events: AdTelemetryEvent[] = [];

  public static track(event: AdTelemetryEvent): void {
    this.events.push(event);
  }

  public static getMetrics(campaignId: string): { impressions: number; clicks: number; conversions: number; ctr: number } {
    const campaignEvents = this.events.filter(e => e.campaignId === campaignId);
    const impressions = campaignEvents.filter(e => e.eventType === "impression").length;
    const clicks = campaignEvents.filter(e => e.eventType === "click").length;
    const conversions = campaignEvents.filter(e => e.eventType === "cta_conversion").length;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return { impressions, clicks, conversions, ctr: parseFloat(ctr.toFixed(2)) };
  }
}

/**
 * 13. AT Protocol-inspired Custom Feed Generators
 */
export type CustomFeedAlgorithm = (posts: FeedPost[], context: Record<string, unknown>) => FeedPost[];

export class FeedGeneratorRegistry {
  private static generators = new Map<string, CustomFeedAlgorithm>();

  public static register(name: string, algorithm: CustomFeedAlgorithm): void {
    this.generators.set(name, algorithm);
  }

  public static resolve(name: string): CustomFeedAlgorithm | undefined {
    return this.generators.get(name);
  }

  public static listAvailable(): string[] {
    return Array.from(this.generators.keys());
  }
}

// Pre-register standard platform algorithms
FeedGeneratorRegistry.register("trending", (posts) => TrendingVelocityRanker.rankByTrending(posts));
FeedGeneratorRegistry.register("media_only", (posts) => posts.filter(p => p.mediaUrls && p.mediaUrls.length > 0));

export { SQLiteFeedStore, type Queryable } from "./feed-store";

