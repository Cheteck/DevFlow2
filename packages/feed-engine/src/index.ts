/**
 * @mosaix/feed-engine — Shared Extensible Feed & Publication Pipeline
 * Decoupled from any specific BAC, provides ActivityStreams-like structures,
 * component resolvers, render interceptors, high-performance feed aggregators,
 * activity grouping, event publishing, caching interfaces, pagination,
 * relevance scoring, ActivityStreams 2.0 serialization, MMR diversity reranking,
 * and feed metrics.
 */

import { DiversityReranker, type DiversityRerankerOptions } from "./velocity-calculator.js";

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

export function isEngageable(entity: unknown): entity is Engageable {
  return (
    typeof entity === "object" &&
    entity !== null &&
    (entity as Engageable).isEngageable === true &&
    typeof (entity as Engageable).targetId === "string"
  );
}

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

export interface FeedPostInterceptor {
  name?: string;
  priority: number;
  canIntercept(post: FeedPost): boolean;
  intercept(post: FeedPost): Promise<FeedPost | null>;
  batchIntercept?(posts: FeedPost[]): Promise<FeedPost[]>;
}

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

export interface FeedEventPublisher {
  publishPostCreated(post: FeedPost): Promise<void>;
  publishPostUpdated(post: FeedPost): Promise<void>;
  publishPostDeleted(postId: string): Promise<void>;
}

export interface FeedCachePort {
  getFeed(feedKey: string): Promise<FeedPost[] | null>;
  setFeed(
    feedKey: string,
    posts: FeedPost[],
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateFeed(feedKey: string): Promise<void>;
}

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

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

export interface PaginatedFeedOptions {
  limit?: number;
  afterCursor?: string;
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

export interface SponsoredPost extends FeedPost {
  isSponsored: true;
  sponsorName: string;
  sponsorBadge?: string;
  ctaText?: string;
  ctaUrl?: string;
  campaignId: string;
}

export function isSponsoredPost(post: unknown): post is SponsoredPost {
  return (
    typeof post === "object" &&
    post !== null &&
    (post as SponsoredPost).isSponsored === true &&
    typeof (post as SponsoredPost).campaignId === "string"
  );
}

export interface FeedRankingWeights {
  recencyWeight?: number;
  engagementWeight?: number;
  affinityWeight?: number;
  timeDecayHalfLifeHours?: number;
}

export interface FeedRankingContext {
  currentUserFollowedSpaces?: string[];
  weights?: FeedRankingWeights;
}

export class FeedRanker {
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

    const ageInHours = Math.max(
      0,
      (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60),
    );
    const recencyScore = Math.pow(
      0.5,
      ageInHours / weights.timeDecayHalfLifeHours,
    );

    const totalEngagements =
      (post.likeCount || 0) * 1 + (post.commentsCount || 0) * 2;
    const engagementScore = Math.min(1, Math.log10(totalEngagements + 1) / 3);

    const isFollowedSpace =
      context.currentUserFollowedSpaces?.includes(post.targetId) ?? false;
    const affinityScore = isFollowedSpace ? 1.0 : 0.2;

    return (
      recencyScore * weights.recencyWeight +
      engagementScore * weights.engagementWeight +
      affinityScore * weights.affinityWeight
    );
  }

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

export interface SponsorshipInjectionOptions {
  interval?: number;
  maxSponsoredPosts?: number;
}

export class SponsoredPostInjector {
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

export interface UserRecommendationProfile {
  userId: string;
  followedSpaceIds: string[];
  interestTags?: string[];
  mutedActorIds?: string[];
  hiddenPostIds?: string[];
}

export class ForYouRecommendationEngine {
  public static generateForYouFeed(
    allPosts: FeedPost[],
    profile: UserRecommendationProfile,
    options: { weights?: FeedRankingWeights; rerankerOptions?: DiversityRerankerOptions } = {},
  ): FeedPost[] {
    const mutedSet = new Set(profile.mutedActorIds || []);
    const hiddenSet = new Set(profile.hiddenPostIds || []);

    const eligiblePosts = allPosts.filter((post) => {
      if (mutedSet.has(post.actorId)) return false;
      if (hiddenSet.has(post.id)) return false;
      return true;
    });

    const relevanceScores = new Map<string, number>();

    const scoredPosts = eligiblePosts.map((post) => {
      const baseScore = FeedRanker.calculateScore(post, {
        currentUserFollowedSpaces: profile.followedSpaceIds,
        weights: options.weights,
      });

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

      const isUnfollowedSpace =
        !profile.followedSpaceIds.includes(post.targetId) &&
        post.targetType === "space";
      const isTrending = post.likeCount + post.commentsCount >= 5;
      const serendipityBonus = isUnfollowedSpace && isTrending ? 0.2 : 0;

      const finalScore = baseScore + interestBonus + serendipityBonus;
      relevanceScores.set(post.id, finalScore);

      return {
        post,
        finalScore,
      };
    });

    scoredPosts.sort((a, b) => b.finalScore - a.finalScore);
    const rankedCandidates = scoredPosts.map((item) => item.post);

    // Pipeline N1 (P2 Remediation): Execute DiversityReranker preserving ForYou relevanceScores (finalScore)
    return DiversityReranker.rerank(rankedCandidates, {
      mutedActorIds: profile.mutedActorIds,
      hiddenPostIds: profile.hiddenPostIds,
      relevanceScores,
      ...options.rerankerOptions,
    });
  }
}

// Re-export extracted velocity, MMR diversity, telemetry & moderation utilities
export {
  TrendingVelocityRanker,
  DiversityReranker,
  FeedMetricsCollector,
  ContentSafetyFilter,
  SponsorshipTelemetry,
  FeedGeneratorRegistry,
  Mulberry32RNG,
  type DiversityRerankerOptions,
  type QualityReport,
  type AdTelemetryEvent,
  type CustomFeedAlgorithm,
} from "./velocity-calculator.js";

export { SQLiteFeedStore, type Queryable } from "./feed-store.js";
