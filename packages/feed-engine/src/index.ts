/**
 * @mosaix/feed-engine ÔÇö Shared Extensible Feed & Publication Pipeline
 * Decoupled from any specific BAC, provides ActivityStreams-like structures,
 * component resolvers, render interceptors, high-performance feed aggregators,
 * activity grouping, event publishing, caching interfaces, pagination,
 * relevance scoring, and ActivityStreams 2.0 serialization.
 */

export type SocialActorType = "user" | "space" | "organization" | "system";

export type PublicationType =
  | "text"
  | "media_gallery"
  | "product_showcase"
  | "booking_slot"
  | "system_advisory"
  | string;

export type FeedTargetType = "feed" | "space" | "group" | "event";

export type FeedVisibility = "public" | "unlisted" | "followers" | "private";

export type ActivityType =
  "create" | "announce" | "like" | "update" | "delete" | string;

export interface FeedAuthor {
  id: string;
  name?: string;
  handle?: string;
  avatarUrl?: string;
  type?: SocialActorType;
}

export interface FeedAttachment {
  id?: string;
  type: "image" | "video" | "audio" | "document" | "link" | string;
  url: string;
  mimeType?: string;
  title?: string;
  previewUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface FeedPollOption {
  id: string;
  text: string;
  votesCount: number;
}

export interface FeedPoll {
  id: string;
  question: string;
  options: FeedPollOption[];
  totalVotes: number;
  expiresAt?: Date;
  isClosed?: boolean;
}

export interface FeedPost {
  id: string;
  actorType: SocialActorType;
  actorId: string;
  author?: FeedAuthor;
  publicationType: PublicationType;
  activityType?: ActivityType;
  targetType: FeedTargetType;
  targetId: string;

  // Threading & Quotes
  parentId?: string;
  rootId?: string;
  quotePostId?: string;
  quotePost?: FeedPost;

  title?: string;
  summary?: string;
  content: string;
  mediaUrls?: string[];
  attachments?: FeedAttachment[];
  poll?: FeedPoll;
  tags?: string[];
  visibility?: FeedVisibility;

  // Metrics & Reactions
  likeCount: number;
  commentsCount: number;
  repostCount?: number;
  reactions?: Record<string, number>;

  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt?: Date;
  isPinned?: boolean;
  isHidden?: boolean;
  isDeleted?: boolean;
}

export interface GroupedActivityCard {
  id: string;
  activityType: ActivityType;
  targetPostId: string;
  actors: FeedAuthor[];
  actorCount: number;
  latestCreatedAt: Date;
  posts: FeedPost[];
}

export interface FeedCardContext {
  currentUser: { id: string; roles?: string[] };
  theme?: "light" | "dark" | "high-contrast";
  locale?: string;
  capabilities?: Record<string, boolean>;
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
export type ReactionType =
  "like" | "love" | "laugh" | "surprised" | "sad" | "angry";

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

export interface StructuredFeedCard {
  id: string;
  publicationType: PublicationType;
  componentName: string;
  props: Record<string, unknown>;
  fallbackHtml: string;
}

/**
 * 1. Component Renderer Interfaces
 */
export interface FeedComponentRenderer {
  publicationType: PublicationType;
  render(post: FeedPost, context: FeedCardContext): string;
}

export interface FeedStructuredRenderer {
  publicationType: PublicationType;
  renderStructured(
    post: FeedPost,
    context: FeedCardContext,
  ): StructuredFeedCard;
}

/**
 * 2. Feed Post Interceptor (Middleware Pipeline)
 */
export interface FeedPostInterceptor {
  name?: string;
  priority: number;
  canIntercept(post: FeedPost): boolean;
  intercept(post: FeedPost): Promise<FeedPost | null>;
  batchIntercept?(posts: FeedPost[]): Promise<FeedPost[]>;
}

/**
 * 3. Stateful FeedEngine Instance
 */
export class FeedEngine {
  private renderers = new Map<string, FeedComponentRenderer>();
  private structuredRenderers = new Map<string, FeedStructuredRenderer>();
  private interceptors: FeedPostInterceptor[] = [];

  public registerRenderer(renderer: FeedComponentRenderer): void {
    this.renderers.set(renderer.publicationType, renderer);
  }

  public unregisterRenderer(publicationType: string): boolean {
    return this.renderers.delete(publicationType);
  }

  public registerStructuredRenderer(renderer: FeedStructuredRenderer): void {
    this.structuredRenderers.set(renderer.publicationType, renderer);
  }

  public unregisterStructuredRenderer(publicationType: string): boolean {
    return this.structuredRenderers.delete(publicationType);
  }

  public registerInterceptor(interceptor: FeedPostInterceptor): void {
    this.interceptors.push(interceptor);
    this.interceptors.sort((a, b) => a.priority - b.priority);
  }

  public unregisterInterceptor(nameOrPriority: string | number): boolean {
    const initialLen = this.interceptors.length;
    if (typeof nameOrPriority === "string") {
      this.interceptors = this.interceptors.filter(
        (i) => i.name !== nameOrPriority,
      );
    } else {
      this.interceptors = this.interceptors.filter(
        (i) => i.priority !== nameOrPriority,
      );
    }
    return this.interceptors.length < initialLen;
  }

  public clear(): void {
    this.renderers.clear();
    this.structuredRenderers.clear();
    this.interceptors = [];
  }

  public renderPost(post: FeedPost, context: FeedCardContext): string {
    const renderer = this.renderers.get(post.publicationType);
    if (renderer) {
      try {
        return renderer.render(post, context);
      } catch (err) {
        console.error(
          `[FeedEngine] Renderer failed for type [${post.publicationType}]:`,
          err,
        );
      }
    }
    return this.renderDefault(post);
  }

  public renderStructuredPost(
    post: FeedPost,
    context: FeedCardContext,
  ): StructuredFeedCard {
    const renderer = this.structuredRenderers.get(post.publicationType);
    if (renderer) {
      try {
        return renderer.renderStructured(post, context);
      } catch (err) {
        console.error(
          `[FeedEngine] Structured renderer failed for [${post.publicationType}]:`,
          err,
        );
      }
    }
    return {
      id: post.id,
      publicationType: post.publicationType,
      componentName: "DefaultFeedCard",
      props: { post },
      fallbackHtml: this.renderDefault(post),
    };
  }

  public async processPostsPipeline(posts: FeedPost[]): Promise<FeedPost[]> {
    const activePosts = posts.filter((p) => !p.isDeleted && !p.isHidden);
    let currentPosts = [...activePosts];

    for (const interceptor of this.interceptors) {
      if (interceptor.batchIntercept) {
        try {
          currentPosts = await interceptor.batchIntercept(currentPosts);
        } catch (err) {
          console.error(
            `[FeedEngine] Batch interceptor error [${interceptor.name || "unnamed"}]:`,
            err,
          );
        }
      } else {
        const nextProcessed: FeedPost[] = [];
        for (const post of currentPosts) {
          if (interceptor.canIntercept(post)) {
            try {
              const res = await interceptor.intercept({ ...post });
              if (res) nextProcessed.push(res);
            } catch (err) {
              console.error(
                `[FeedEngine] Interceptor error on post [${post.id}]:`,
                err,
              );
              nextProcessed.push(post);
            }
          } else {
            nextProcessed.push(post);
          }
        }
        currentPosts = nextProcessed;
      }
    }
    return currentPosts.filter((p) => !p.isDeleted && !p.isHidden);
  }

  private renderDefault(post: FeedPost): string {
    const safeContent = String(post.content || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const safeTitle = post.title
      ? `<div class="font-bold mb-1">${String(post.title).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`
      : "";

    return `
      <div class="p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 text-xs text-on-surface leading-relaxed">
        ${safeTitle}${safeContent}
      </div>
    `.trim();
  }
}

/**
 * 4. Static Proxy Registry
 */
export class FeedEngineRegistry {
  private static defaultInstance = new FeedEngine();

  public static getDefaultEngine(): FeedEngine {
    return this.defaultInstance;
  }

  public static registerRenderer(renderer: FeedComponentRenderer): void {
    this.defaultInstance.registerRenderer(renderer);
  }

  public static unregisterRenderer(publicationType: string): boolean {
    return this.defaultInstance.unregisterRenderer(publicationType);
  }

  public static registerStructuredRenderer(
    renderer: FeedStructuredRenderer,
  ): void {
    this.defaultInstance.registerStructuredRenderer(renderer);
  }

  public static registerInterceptor(interceptor: FeedPostInterceptor): void {
    this.defaultInstance.registerInterceptor(interceptor);
  }

  public static unregisterInterceptor(
    nameOrPriority: string | number,
  ): boolean {
    return this.defaultInstance.unregisterInterceptor(nameOrPriority);
  }

  public static clear(): void {
    this.defaultInstance.clear();
  }

  public static renderPost(post: FeedPost, context: FeedCardContext): string {
    return this.defaultInstance.renderPost(post, context);
  }

  public static renderStructuredPost(
    post: FeedPost,
    context: FeedCardContext,
  ): StructuredFeedCard {
    return this.defaultInstance.renderStructuredPost(post, context);
  }

  public static async processPostsPipeline(
    posts: FeedPost[],
  ): Promise<FeedPost[]> {
    return this.defaultInstance.processPostsPipeline(posts);
  }
}

/**
 * 5. Feed Aggregation Utility
 */
export interface FeedAggregationOptions {
  followedSpaceIds?: string[];
  followedGroupIds?: string[];
  followedEventIds?: string[];
  blockedActorIds?: string[];
  mutedTags?: string[];
  allowedVisibilities?: FeedVisibility[];
  sortBy?: "chronological" | "reverse_chronological" | "engagement" | "score";
  now?: Date;
}

export class FeedAggregator {
  public static aggregate(
    allPosts: FeedPost[],
    followedSpaceIdsOrOptions: string[] | FeedAggregationOptions,
    legacyFollowedSpaceIds?: string[],
  ): FeedPost[] {
    let options: FeedAggregationOptions;

    if (Array.isArray(followedSpaceIdsOrOptions)) {
      options = {
        followedSpaceIds: followedSpaceIdsOrOptions,
      };
    } else {
      options = followedSpaceIdsOrOptions || {};
    }

    if (legacyFollowedSpaceIds && !options.followedSpaceIds) {
      options.followedSpaceIds = legacyFollowedSpaceIds;
    }

    const spaceIds = new Set(options.followedSpaceIds || []);
    const groupIds = new Set(options.followedGroupIds || []);
    const eventIds = new Set(options.followedEventIds || []);
    const blockedActors = new Set(options.blockedActorIds || []);
    const mutedTags = new Set(
      (options.mutedTags || []).map((t) => t.toLowerCase()),
    );
    const allowedVisibilities = options.allowedVisibilities
      ? new Set(options.allowedVisibilities)
      : null;

    const filtered = allPosts.filter((post) => {
      if (post.isDeleted || post.isHidden) return false;
      if (blockedActors.has(post.actorId)) return false;

      if (
        post.visibility &&
        allowedVisibilities &&
        !allowedVisibilities.has(post.visibility)
      ) {
        return false;
      }

      if (post.tags && post.tags.some((t) => mutedTags.has(t.toLowerCase()))) {
        return false;
      }

      switch (post.targetType) {
        case "feed":
          return true;
        case "space":
          return spaceIds.has(post.targetId);
        case "group":
          return groupIds.has(post.targetId);
        case "event":
          return eventIds.has(post.targetId);
        default:
          return false;
      }
    });

    const sortBy = options.sortBy || "reverse_chronological";
    const referenceDate = options.now || new Date();

    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      switch (sortBy) {
        case "chronological":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "engagement": {
          const scoreA =
            a.likeCount + a.commentsCount * 2 + (a.repostCount || 0) * 3;
          const scoreB =
            b.likeCount + b.commentsCount * 2 + (b.repostCount || 0) * 3;
          return scoreB - scoreA;
        }
        case "score": {
          const scoreA = FeedScorer.calculateScore(a, referenceDate);
          const scoreB = FeedScorer.calculateScore(b, referenceDate);
          return scoreB - scoreA;
        }
        case "reverse_chronological":
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  }

  public static aggregatePaginated(
    allPosts: FeedPost[],
    followedSpaceIds: string[],
    options: PaginatedFeedOptions = {},
  ): PaginatedFeedResult {
    const sorted = this.aggregate(allPosts, followedSpaceIds);
    const limit = options.limit && options.limit > 0 ? options.limit : 20;

    let filtered = sorted;
    if (options.afterCursor) {
      const cursorTime = new Date(options.afterCursor).getTime();
      if (!isNaN(cursorTime)) {
        filtered = filtered.filter((p) => p.createdAt.getTime() < cursorTime);
      }
    }

    const items = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const lastItem = items[items.length - 1];
    const nextCursor = lastItem ? lastItem.createdAt.toISOString() : undefined;

    return {
      items,
      hasMore,
      nextCursor,
    };
  }
}

/**
 * 6. Activity Grouper / Aggregation Utility
 * Groups notification-like repetitive activities (e.g., "Alice, Bob and 3 others liked your post")
 */
export class ActivityGrouper {
  public static groupActivities(
    posts: FeedPost[],
  ): Array<FeedPost | GroupedActivityCard> {
    const groupedMap = new Map<string, FeedPost[]>();
    const standalone: FeedPost[] = [];

    for (const post of posts) {
      if (
        (post.activityType === "like" || post.activityType === "announce") &&
        post.parentId
      ) {
        const key = `${post.activityType}:${post.parentId}`;
        const existing = groupedMap.get(key) || [];
        existing.push(post);
        groupedMap.set(key, existing);
      } else {
        standalone.push(post);
      }
    }

    const result: Array<FeedPost | GroupedActivityCard> = [...standalone];

    for (const [key, group] of groupedMap.entries()) {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        const [actType, targetPostId] = key.split(":");
        const actors: FeedAuthor[] = group
          .map((g) => g.author || { id: g.actorId })
          .filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);

        const latestDate = new Date(
          Math.max(...group.map((g) => g.createdAt.getTime())),
        );

        result.push({
          id: `grouped_${key}_${latestDate.getTime()}`,
          activityType: actType as ActivityType,
          targetPostId,
          actors,
          actorCount: actors.length,
          latestCreatedAt: latestDate,
          posts: group,
        });
      }
    }

    return result;
  }
}

/**
 * 7. Feed Event Publisher Port Integration
 */
export interface FeedEventPublisher {
  publishPostCreated(post: FeedPost): Promise<void>;
  publishPostUpdated(post: FeedPost): Promise<void>;
  publishPostDeleted(postId: string): Promise<void>;
}

/**
 * 8. Feed Cache Port Interface
 */
export interface FeedCachePort {
  getFeed(feedKey: string): Promise<FeedPost[] | null>;
  setFeed(
    feedKey: string,
    posts: FeedPost[],
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateFeed(feedKey: string): Promise<void>;
}

/**
 * 9. Feed Relevance Scorer
 */
export class FeedScorer {
  public static calculateScore(
    post: FeedPost,
    referenceDate: Date = new Date(),
    gravity = 1.8,
  ): number {
    const likes = post.likeCount || 0;
    const comments = post.commentsCount || 0;
    const reposts = post.repostCount || 0;

    const rawEngagement = likes * 1 + comments * 2 + reposts * 3 + 1;
    const ageInHours = Math.max(
      0,
      (referenceDate.getTime() - post.createdAt.getTime()) / (1000 * 60 * 60),
    );

    return rawEngagement / Math.pow(ageInHours + 2, gravity);
  }
}

/**
 * 10. Feed Cursor-Based Paginator
 */
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

export interface PaginatedFeedOptions {
  limit?: number;
  afterCursor?: string; // ISO date or Post ID
  beforeCursor?: string;
}

export interface PaginatedFeedResult {
  items: FeedPost[];
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
}

export class FeedPaginator {
  public static encodeCursor(date: Date, id: string): string {
    const raw = `${date.getTime()}:${id}`;
    if (typeof Buffer !== "undefined") {
      return Buffer.from(raw).toString("base64url");
    }
    return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  public static decodeCursor(
    cursor: string,
  ): { timestamp: number; id: string } | null {
    try {
      let raw = "";
      if (typeof Buffer !== "undefined") {
        raw = Buffer.from(cursor, "base64url").toString("utf-8");
      } else {
        const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
        raw = atob(base64);
      }
      const [tsStr, id] = raw.split(":");
      const timestamp = parseInt(tsStr, 10);
      if (isNaN(timestamp) || !id) return null;
      return { timestamp, id };
    } catch {
      return null;
    }
  }

  public static paginate(
    posts: FeedPost[],
    options: PaginationOptions = {},
  ): PaginatedFeedResult {
    const limit = Math.max(1, options.limit || 20);
    let filteredPosts = [...posts];

    if (options.cursor) {
      const cursorData = this.decodeCursor(options.cursor);
      if (cursorData) {
        filteredPosts = filteredPosts.filter((p) => {
          const pTs = p.createdAt.getTime();
          if (pTs < cursorData.timestamp) return true;
          if (pTs === cursorData.timestamp) return p.id < cursorData.id;
          return false;
        });
      }
    }

    const items = filteredPosts.slice(0, limit);
    const hasMore = filteredPosts.length > limit;

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = this.encodeCursor(lastItem.createdAt, lastItem.id);
    }

    return {
      items,
      hasMore,
      nextCursor,
      totalCount: posts.length,
    };
  }
}

/**
 * 11. ActivityStreams 2.0 & JSON Feed Serializer
 */
export interface ActivityStreamObject {
  "@context"?: string | string[];
  id: string;
  type: string;
  actor: {
    id: string;
    type: string;
    name?: string;
    preferredUsername?: string;
    icon?: { type: string; url: string };
  };
  object: {
    id: string;
    type: string;
    attributedTo?: string;
    content: string;
    name?: string;
    summary?: string;
    published: string;
    updated?: string;
    tag?: Array<{ type: string; name: string }>;
    attachment?: Array<{
      type: string;
      mediaType?: string;
      url: string;
      name?: string;
    }>;
    to?: string[];
  };
  published: string;
}

export class ActivityStreamsMapper {
  public static toActivityStream(post: FeedPost): ActivityStreamObject {
    const actorTypeMap: Record<SocialActorType, string> = {
      user: "Person",
      space: "Group",
      organization: "Organization",
      system: "Application",
    };

    const mappedActorType = actorTypeMap[post.actorType] || "Person";

    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `urn:mosaix:activity:${post.id}`,
      type: post.activityType || "Create",
      actor: {
        id: post.author?.id || post.actorId,
        type: mappedActorType,
        name: post.author?.name,
        preferredUsername: post.author?.handle,
        icon: post.author?.avatarUrl
          ? { type: "Image", url: post.author.avatarUrl }
          : undefined,
      },
      object: {
        id: `urn:mosaix:post:${post.id}`,
        type: "Note",
        attributedTo: post.actorId,
        content: post.content,
        name: post.title,
        summary: post.summary,
        published: post.createdAt.toISOString(),
        updated: post.updatedAt?.toISOString(),
        tag: post.tags?.map((t) => ({ type: "Hashtag", name: t })),
        attachment: post.attachments?.map((a) => ({
          type: "Document",
          mediaType: a.mimeType,
          url: a.url,
          name: a.title,
        })),
        to:
          post.visibility === "public"
            ? ["https://www.w3.org/ns/activitystreams#Public"]
            : undefined,
      },
      published: post.createdAt.toISOString(),
    };
  }

  public static fromActivityStream(
    activity: ActivityStreamObject,
  ): Partial<FeedPost> {
    const obj = activity.object || {};
    const actor = activity.actor || {};

    const reverseActorMap: Record<string, SocialActorType> = {
      Person: "user",
      Group: "space",
      Organization: "organization",
      Application: "system",
    };

    return {
      id: obj.id
        ? obj.id.replace(/^urn:mosaix:post:/, "")
        : activity.id
          ? activity.id.replace(/^urn:mosaix:activity:/, "")
          : "unknown",
      actorType: reverseActorMap[actor.type] || "user",
      actorId: actor.id || "unknown",
      author: {
        id: actor.id || "unknown",
        name: actor.name,
        handle: actor.preferredUsername,
        avatarUrl: actor.icon?.url,
      },
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      title: obj.name,
      summary: obj.summary,
      content: obj.content || "",
      tags: obj.tag?.map((t) => t.name),
      attachments: obj.attachment?.map((a) => ({
        type: a.type || "link",
        url: a.url,
        mimeType: a.mediaType,
        title: a.name,
      })),
      likeCount: 0,
      commentsCount: 0,
      createdAt: new Date(obj.published || activity.published || Date.now()),
    };
  }
}

/**
 * 12. W3C ActivityStreams / ActivityPub Converter Utility
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
  public static toActivityPubJSON(
    post: FeedPost,
    instanceDomain = "mosaix.local",
  ): ActivityStreamsNote {
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `https://${instanceDomain}/posts/${post.id}`,
      type: "Note",
      attributedTo: `https://${instanceDomain}/actors/${post.actorType}/${post.actorId}`,
      content: post.content,
      published: post.createdAt.toISOString(),
      attachment: post.mediaUrls?.map((url) => ({
        type: "Image",
        href: url,
      })),
      likeCount: post.likeCount,
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
      mediaUrls: note.attachment?.map((att) => att.href),
      likeCount: note.likeCount || 0,
      commentsCount: 0,
      createdAt: new Date(note.published),
    };
  }
}

/**
 * 13. Sponsored / Promoted Publications Contract
 */
export interface SponsoredPost extends FeedPost {
  isSponsored: true;
  sponsorName: string;
  sponsorBadge?: string; // e.g., "Sponsoris├®", "Sponsoris├® par MosaiX"
  ctaText?: string; // e.g., "D├®couvrir l'offre", "R├®server un cr├®neau"
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
 * 14. Algorithmic Feed Ranking & Scoring Engine
 */
export interface FeedRankingWeights {
  recencyWeight?: number; // default: 0.4
  engagementWeight?: number; // default: 0.3
  affinityWeight?: number; // default: 0.3
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
  public static calculateScore(
    post: FeedPost,
    context: FeedRankingContext = {},
  ): number {
    const weights = {
      recencyWeight: context.weights?.recencyWeight ?? 0.4,
      engagementWeight: context.weights?.engagementWeight ?? 0.3,
      affinityWeight: context.weights?.affinityWeight ?? 0.3,
      timeDecayHalfLifeHours: context.weights?.timeDecayHalfLifeHours ?? 24,
    };

    // A. Recency Decay (exponential decay)
    const ageInHours = Math.max(
      0,
      (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60),
    );
    const recencyScore = Math.pow(
      0.5,
      ageInHours / weights.timeDecayHalfLifeHours,
    );

    // B. Engagement Score (logarithmic scaling for reactions and comments)
    const totalEngagements =
      (post.likeCount || 0) * 1 + (post.commentsCount || 0) * 2;
    const engagementScore = Math.min(1, Math.log10(totalEngagements + 1) / 3);

    // C. Affinity Score
    const isFollowedSpace =
      context.currentUserFollowedSpaces?.includes(post.targetId) ?? false;
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
  public static rank(
    posts: FeedPost[],
    context: FeedRankingContext = {},
  ): FeedPost[] {
    return [...posts].sort(
      (a, b) =>
        this.calculateScore(b, context) - this.calculateScore(a, context),
    );
  }
}

/**
 * 15. Sponsored Publications Injection Engine
 */
export interface SponsorshipInjectionOptions {
  interval?: number; // insert 1 sponsored post every N organic posts (default: 5)
  maxSponsoredPosts?: number; // max sponsored posts per feed view (default: 3)
}

export class SponsoredPostInjector {
  /**
   * Interjects sponsored publications into organic feeds at configured intervals.
   */
  public static inject(
    organicPosts: FeedPost[],
    sponsoredPool: SponsoredPost[],
    options: SponsorshipInjectionOptions = {},
  ): FeedPost[] {
    if (!sponsoredPool || sponsoredPool.length === 0) return organicPosts;

    const interval =
      options.interval && options.interval > 0 ? options.interval : 5;
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
 * 16. "Pour Toi" (For You) Personalized Recommendation Engine
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
    options: { weights?: FeedRankingWeights } = {},
  ): FeedPost[] {
    // A. Filter out muted actors & hidden posts
    const mutedSet = new Set(profile.mutedActorIds || []);
    const hiddenSet = new Set(profile.hiddenPostIds || []);

    const eligiblePosts = allPosts.filter((post) => {
      if (mutedSet.has(post.actorId)) return false;
      if (hiddenSet.has(post.id)) return false;
      return true;
    });

    // B. Calculate personalized recommendation score
    const scoredPosts = eligiblePosts.map((post) => {
      // Base algorithmic ranking score
      const baseScore = FeedRanker.calculateScore(post, {
        currentUserFollowedSpaces: profile.followedSpaceIds,
        weights: options.weights,
      });

      // Interest tag match bonus
      let interestBonus = 0;
      if (
        profile.interestTags &&
        profile.interestTags.length > 0 &&
        post.metadata?.tags
      ) {
        const postTags = Array.isArray(post.metadata.tags)
          ? post.metadata.tags
          : [];
        const matchingTags = postTags.filter((tag) =>
          profile.interestTags!.includes(String(tag)),
        );
        interestBonus = matchingTags.length * 0.25;
      }

      // Serendipity bonus for highly engaging trending posts outside followed spaces
      const isUnfollowedSpace =
        !profile.followedSpaceIds.includes(post.targetId) &&
        post.targetType === "space";
      const isTrending = post.likeCount + post.commentsCount >= 5;
      const serendipityBonus = isUnfollowedSpace && isTrending ? 0.2 : 0;

      return {
        post,
        finalScore: baseScore + interestBonus + serendipityBonus,
      };
    });

    // C. Sort descending by final recommendation score
    scoredPosts.sort((a, b) => b.finalScore - a.finalScore);

    return scoredPosts.map((item) => item.post);
  }
}

/**
 * 17. Trending & Viral Velocity Algorithm (Inspired by HackerNews / Reddit / Phoenix)
 * Velocity = (Engagements) / (Age + 2)^gravity
 */
export class TrendingVelocityRanker {
  public static calculateVelocity(post: FeedPost, gravity = 1.6): number {
    const ageInHours = Math.max(
      0,
      (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60),
    );
    const rawEngagements =
      (post.likeCount || 0) * 2 + (post.commentsCount || 0) * 4;
    return rawEngagements / Math.pow(ageInHours + 2, gravity);
  }

  public static rankByTrending(posts: FeedPost[], gravity = 1.6): FeedPost[] {
    return [...posts].sort(
      (a, b) =>
        this.calculateVelocity(b, gravity) - this.calculateVelocity(a, gravity),
    );
  }
}

/**
 * 18. Content Safety & Quality Moderation Engine
 * Evaluates spam, abusive patterns, repetition, and assigns a quality score.
 */
export interface QualityReport {
  score: number; // 0.0 to 1.0 (1.0 is pristine quality)
  isSafe: boolean;
  flags: string[];
}

export class ContentSafetyFilter {
  private static SPAM_KEYWORDS = [
    "viagra",
    "crypto giveaway",
    "free money",
    "gagnez 10000Ôé¼",
    "double your coins",
    "whatsapp me",
    "click here fast",
    "earn from home fast",
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
    if (
      post.content.length > 20 &&
      uppercaseCount / post.content.length > 0.6
    ) {
      flags.push("excessive_caps");
      penalty += 0.15;
    }

    // 4. Short / Low Effort content
    if (
      post.content.trim().length < 5 &&
      (!post.mediaUrls || post.mediaUrls.length === 0)
    ) {
      flags.push("low_effort");
      penalty += 0.1;
    }

    const score = Math.max(0, Math.min(1, 1.0 - penalty));
    const isSafe =
      score >= 0.5 && !flags.some((f) => f.startsWith("spam_keyword"));

    return { score, isSafe, flags };
  }

  public static filterUnsafe(posts: FeedPost[]): FeedPost[] {
    return posts.filter((post) => this.evaluate(post).isSafe);
  }
}

/**
 * 19. Sponsored Ads Telemetry & Impression Tracker
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

  public static getMetrics(campaignId: string): {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
  } {
    const campaignEvents = this.events.filter(
      (e) => e.campaignId === campaignId,
    );
    const impressions = campaignEvents.filter(
      (e) => e.eventType === "impression",
    ).length;
    const clicks = campaignEvents.filter((e) => e.eventType === "click").length;
    const conversions = campaignEvents.filter(
      (e) => e.eventType === "cta_conversion",
    ).length;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return {
      impressions,
      clicks,
      conversions,
      ctr: parseFloat(ctr.toFixed(2)),
    };
  }
}

/**
 * 20. AT Protocol-inspired Custom Feed Generators
 */
export type CustomFeedAlgorithm = (
  posts: FeedPost[],
  context: Record<string, unknown>,
) => FeedPost[];

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
FeedGeneratorRegistry.register("trending", (posts) =>
  TrendingVelocityRanker.rankByTrending(posts),
);
FeedGeneratorRegistry.register("media_only", (posts) =>
  posts.filter((p) => p.mediaUrls && p.mediaUrls.length > 0),
);

export { SQLiteFeedStore, type Queryable } from "./feed-store.js";
