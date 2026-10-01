/**
 * @mosaix/feed-engine — Shared Types & Interfaces
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
  | "create"
  | "announce"
  | "like"
  | "update"
  | "delete"
  | string;

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

/**
 * Trait 2: Engageable
 */
export type ReactionType =
  | "like"
  | "love"
  | "laugh"
  | "surprised"
  | "sad"
  | "angry";

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

export interface SponsoredPost extends FeedPost {
  isSponsored: true;
  sponsorName: string;
  sponsorBadge?: string;
  ctaText?: string;
  ctaUrl?: string;
  campaignId: string;
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

export interface UserRecommendationProfile {
  userId: string;
  followedSpaceIds: string[];
  interestTags?: string[];
  mutedActorIds?: string[];
  hiddenPostIds?: string[];
}
