import * as crypto from "node:crypto";
import { Model } from "@mosaix/sdk";
import { TrendingVelocityRanker, FeedMetricsCollector, type FeedPost } from "@mosaix/feed-engine";
import { HumanReviewQueueStage, type ReviewQueueItem } from "./solara-moderation-pipeline.js";

export type SocialActorType = "user" | "space" | "organization" | "system";

export type DefaultPublicationType =
  | "text"
  | "article"
  | "poll"
  | "media_gallery"
  | "event_announcement"
  | "product_showcase"
  | "job_offer"
  | string;

export interface PublicationTypeDefinition {
  type: DefaultPublicationType;
  name: string;
  description: string;
  requiredMetadataFields?: string[];
}

export class PublicationTypeRegistry {
  private types = new Map<string, PublicationTypeDefinition>([
    [
      "text",
      { type: "text", name: "Publication Texte / Post Court", description: "Message texte standard avec médias optionnels." },
    ],
    [
      "article",
      { type: "article", name: "Article Long / Blog", description: "Article structuré avec titre, sous-titre et contenu riche.", requiredMetadataFields: ["title"] },
    ],
    [
      "poll",
      { type: "poll", name: "Sondage Interactif", description: "Sondage avec options de votes multiples.", requiredMetadataFields: ["options"] },
    ],
    [
      "media_gallery",
      { type: "media_gallery", name: "Galerie Médias", description: "Album photos ou vidéos.", requiredMetadataFields: ["mediaUrls"] },
    ],
    [
      "event_announcement",
      { type: "event_announcement", name: "Annonce d'Événement", description: "Annonce liée à un événement Events BAC.", requiredMetadataFields: ["eventId", "eventDate"] },
    ],
    [
      "product_showcase",
      { type: "product_showcase", name: "Vitrine Produit", description: "Mise en avant d'un vendable du Commerce BAC.", requiredMetadataFields: ["productId", "price"] },
    ],
  ]);

  registerPublicationType(definition: PublicationTypeDefinition): void {
    this.types.set(definition.type, definition);
  }

  getPublicationType(type: string): PublicationTypeDefinition | undefined {
    return this.types.get(type);
  }

  listPublicationTypes(): PublicationTypeDefinition[] {
    return Array.from(this.types.values());
  }

  validateMetadata(type: string, metadata?: Record<string, unknown>): { valid: boolean; missingFields: string[] } {
    const def = this.getPublicationType(type);
    if (!def || !def.requiredMetadataFields) {
      return { valid: true, missingFields: [] };
    }

    const missing: string[] = [];
    for (const field of def.requiredMetadataFields) {
      if (!metadata || metadata[field] === undefined) {
        missing.push(field);
      }
    }

    return { valid: missing.length === 0, missingFields: missing };
  }
}

export class PostModel extends Model {
  static override tableName = "solara_posts";

  actorType!: SocialActorType;
  actorId!: string;
  targetType!: "feed" | "space" | "group" | "event";
  targetId!: string;
  content!: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
  likeCount!: number;
  commentsCount!: number;
}

export class CommentModel extends Model {
  static override tableName = "solara_comments";

  postId!: string;
  actorType!: SocialActorType;
  actorId!: string;
  content!: string;
}

export class ReactionModel extends Model {
  static override tableName = "solara_reactions";

  targetType!: "post" | "comment";
  targetId!: string;
  actorType!: SocialActorType;
  actorId!: string;
  type!: "like" | "love" | "laugh" | "surprised" | "sad" | "angry";
}

export class FollowerModel extends Model {
  static override tableName = "solara_followers";

  followerActorType!: SocialActorType;
  followerActorId!: string;
  targetActorType!: SocialActorType;
  targetActorId!: string;
  declare createdAt: Date;
}

export interface Post {
  id: string;
  actorType: SocialActorType;
  actorId: string;
  publicationType: DefaultPublicationType;
  targetType: "feed" | "space" | "group" | "event";
  targetId: string;
  content: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
  likeCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
  isPinned?: boolean;
  repostCount?: number;
}

export interface PollOptionState {
  id: string;
  text: string;
  votes: number;
}

export interface PollState {
  options: PollOptionState[];
  voters: string[];
}

export interface Comment {
  id: string;
  postId: string;
  actorType: SocialActorType;
  actorId: string;
  content: string;
  createdAt: Date;
}

export interface FollowerRelation {
  id: string;
  followerActorType: SocialActorType;
  followerActorId: string;
  targetActorType: SocialActorType;
  targetActorId: string;
  createdAt: Date;
}

export interface SocialReaction {
  id: string;
  targetType: "post" | "comment";
  targetId: string;
  actorType?: SocialActorType;
  actorId: string;
  type: string;
  createdAt: Date;
}

export interface SocialRepositoryPort {
  savePost(post: Post): Promise<void>;
  getPost(id: string): Promise<Post | null>;
  getPosts(limit?: number): Promise<Post[]>;
  saveComment(postId: string, comment: Comment): Promise<void>;
  getComments(postId: string): Promise<Comment[]>;
  addFollower(targetActorId: string, follower: FollowerRelation): Promise<void>;
  getFollowers(targetActorId: string): Promise<FollowerRelation[]>;
  saveReaction(targetType: "post" | "comment", targetId: string, reaction: SocialReaction): Promise<void>;
  getReactions(targetType: "post" | "comment", targetId: string): Promise<SocialReaction[]>;
  incrementLikeCount(postId: string, delta: number): Promise<void>;
  incrementCommentsCount(postId: string, delta: number): Promise<void>;
}

export type SolaraContentHook = (
  content: string
) => Promise<{ approved: boolean; modifiedContent?: string; reason?: string }> | { approved: boolean; modifiedContent?: string; reason?: string };

export class SolaraSocialService {
  private posts = new Map<string, Post>();
  private comments = new Map<string, Comment[]>();
  private followers = new Map<string, FollowerRelation[]>();
  private contentHooks: SolaraContentHook[] = [];
  // Constitution (InMemoryGuard) : aucun contenu démo par défaut — le pool
  // sponsorisé se remplit uniquement via `addSponsoredPost` (campagnes réelles).
  // L'ancien item démo "sponsored-1" (E-Commerce MosaiX, 42 likes) a été retiré.
  private sponsoredPool: import("@mosaix/feed-engine").SponsoredPost[] = [];
  public publicationTypeRegistry = new PublicationTypeRegistry();

  /** First real producer of the human moderation queue (FEED-V1-06). */
  public readonly moderationQueue = new HumanReviewQueueStage();

  /** Per-user muted actors (FEED-V1-07). In-memory only: no repository table yet. */
  private readonly mutedByUser = new Map<string, Set<string>>();

  public getSponsoredPool(): import("@mosaix/feed-engine").SponsoredPost[] {
    return this.sponsoredPool;
  }

  public addSponsoredPost(post: import("@mosaix/feed-engine").SponsoredPost): void {
    this.sponsoredPool.push(post);
  }

  constructor(private readonly repository?: SocialRepositoryPort) {}

  registerContentHook(hook: SolaraContentHook): void {
    this.contentHooks.push(hook);
  }

  async createPost(
    actorType: SocialActorType,
    actorId: string,
    targetType: "feed" | "space" | "group" | "event",
    targetId: string,
    content: string,
    publicationType: DefaultPublicationType = "text",
    metadata?: Record<string, unknown>,
    mediaUrls: string[] = []
  ): Promise<Post> {
    const validation = this.publicationTypeRegistry.validateMetadata(publicationType, metadata);
    if (!validation.valid) {
      throw new Error(`Métadonnées manquantes pour le type de publication [${publicationType}] : ${validation.missingFields.join(", ")}`);
    }

    // FEED-V1-03: normalize poll options into a votable state envelope.
    let finalMetadata = metadata;
    if (publicationType === "poll") {
      const rawOptions = Array.isArray(metadata?.options) ? metadata.options : [];
      const options: PollOptionState[] = rawOptions.map((o: unknown, i: number) => {
        const rec = (o ?? {}) as Record<string, unknown>;
        return {
          id: String(rec.id ?? `opt-${i + 1}`),
          text: String(rec.text ?? ""),
          votes: Number(rec.votes ?? 0),
        };
      });
      finalMetadata = { ...(metadata ?? {}), poll: { options, voters: [] } satisfies PollState };
    }

    let finalContent = content;

    for (const hook of this.contentHooks) {
      const result = await Promise.resolve(hook(finalContent));
      if (!result.approved) {
        throw new Error(`Publication rejetée par le plugin de modération : ${result.reason ?? "Contenu non conforme"}`);
      }
      if (result.modifiedContent) {
        finalContent = result.modifiedContent;
      }
    }

    const id = `post-${crypto.randomUUID()}`;
    const post: Post = {
      id,
      actorType,
      actorId,
      publicationType,
      targetType,
      targetId,
      content: finalContent,
      mediaUrls,
      ...(finalMetadata ? { metadata: finalMetadata } : {}),
      likeCount: 0,
      commentsCount: 0,
      createdAt: new Date(),
    };

    this.posts.set(id, post);
    this.comments.set(id, []);

    if (this.repository) {
      await this.repository.savePost(post);
    }

    return post;
  }

  listFeed(targetType?: string, targetId?: string, publicationType?: string): Post[] {
    let list = Array.from(this.posts.values()).filter((p) => !p.isDeleted);
    if (targetType && targetId) {
      list = list.filter((p) => p.targetType === targetType && p.targetId === targetId);
    }
    if (publicationType) {
      list = list.filter((p) => p.publicationType === publicationType);
    }
    return list;
  }

  /**
   * Scans outbound follow relations where followerActorId is the follower.
   * Returns list of target actor/space IDs followed by followerActorId.
   */
  public getFollowedTargets(followerActorId: string): string[] {
    const followed = new Set<string>();
    for (const rels of this.followers.values()) {
      for (const rel of rels) {
        if (rel.followerActorId === followerActorId) {
          followed.add(rel.targetActorId);
        }
      }
    }
    return Array.from(followed);
  }

  /**
   * Périmètre N1 — Multi-source feed aggregation with source quotas.
   * Fuses 3 sources: 'followed' (quota: followedLimit), 'trending' (quota: trendingLimit), and 'recent' (quota: recentLimit).
   * Deduplicates by post.id. Preserves modes: 'for_you', 'trending', 'chronological'.
   */
  public listFeedMultiSource(
    followerActorId?: string,
    mode: "for_you" | "trending" | "chronological" = "for_you",
    options: {
      targetType?: string;
      targetId?: string;
      publicationType?: string;
      followedLimit?: number;
      trendingLimit?: number;
      recentLimit?: number;
    } = {}
  ): Post[] {
    const allPosts = this.listFeed(options.targetType, options.targetId, options.publicationType);

    if (mode === "chronological") {
      return [...allPosts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    if (mode === "trending") {
      return [...allPosts].sort((a, b) => {
        const velA = TrendingVelocityRanker.calculateVelocity(postToFeedPost(a));
        const velB = TrendingVelocityRanker.calculateVelocity(postToFeedPost(b));
        return velB - velA;
      });
    }

    const followedLimit = options.followedLimit ?? 10;
    const trendingLimit = options.trendingLimit ?? 10;
    const recentLimit = options.recentLimit ?? 10;

    // Default 'for_you': Multi-source fusion with quotas & deduplication
    const followedTargets = new Set<string>(followerActorId ? this.getFollowedTargets(followerActorId) : []);

    // Source 1: Followed
    const followedPool = allPosts
      .filter((p) => followedTargets.has(p.actorId) || followedTargets.has(p.targetId))
      .slice(0, followedLimit);

    // Source 2: Trending (top velocity)
    const trendingPool = [...allPosts]
      .sort((a, b) => {
        const velA = TrendingVelocityRanker.calculateVelocity(postToFeedPost(a));
        const velB = TrendingVelocityRanker.calculateVelocity(postToFeedPost(b));
        return velB - velA;
      })
      .slice(0, trendingLimit);

    // Source 3: Recent (chronological)
    const recentPool = [...allPosts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, recentLimit);

    // Fusion & Deduplication by ID
    const mergedMap = new Map<string, Post>();

    for (const post of followedPool) {
      mergedMap.set(post.id, post);
    }
    for (const post of trendingPool) {
      if (!mergedMap.has(post.id)) {
        mergedMap.set(post.id, post);
      }
    }
    for (const post of recentPool) {
      if (!mergedMap.has(post.id)) {
        mergedMap.set(post.id, post);
      }
    }

    return Array.from(mergedMap.values());
  }

  /**
   * Async variant: hydrates the in-memory map from the repository (Postgres,
   * when wired) before running the multi-source fusion, so DB-persisted posts
   * are visible to server-side readers. Falls back to in-memory state when
   * no repository is configured or hydration fails.
   */
  public async listFeedMultiSourceAsync(
    followerActorId?: string,
    mode: "for_you" | "trending" | "chronological" = "for_you",
    options: {
      targetType?: string;
      targetId?: string;
      publicationType?: string;
      followedLimit?: number;
      trendingLimit?: number;
      recentLimit?: number;
    } = {}
  ): Promise<Post[]> {
    await this.listFeedAsync(options.targetType, options.targetId, options.publicationType);
    return this.listFeedMultiSource(followerActorId, mode, options);
  }

  async listFeedAsync(targetType?: string, targetId?: string, publicationType?: string): Promise<Post[]> {    if (this.repository) {
      try {
        const fromDb = await this.repository.getPosts(100);
        if (fromDb.length > 0) {
          for (const p of fromDb) {
            this.posts.set(p.id, p);
          }
        }
      } catch (err: unknown) {
        console.error("[Solara] Failed to fetch feed from Postgres:", err);
      }
    }
    return this.listFeed(targetType, targetId, publicationType);
  }

  async getPostAsync(id: string): Promise<Post | null> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getPost(id);
        if (fromDb) {
          this.posts.set(fromDb.id, fromDb);
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solara] Failed to fetch post from Postgres:", err);
      }
    }
    return this.posts.get(id) ?? null;
  }

  async addComment(postId: string, actorType: SocialActorType, actorId: string, content: string): Promise<Comment> {
    const post = await this.getPostAsync(postId);
    if (!post) throw new Error(`Post [${postId}] non trouvé.`);

    const comment: Comment = {
      id: `cmt-${crypto.randomUUID()}`,
      postId,
      actorType,
      actorId,
      content,
      createdAt: new Date(),
    };

    const list = this.comments.get(postId) ?? [];
    list.push(comment);
    this.comments.set(postId, list);
    post.commentsCount++;

    if (this.repository) {
      await this.repository.saveComment(postId, comment);
      await this.repository.incrementCommentsCount(postId, 1);
    }

    // Telemetry: record interaction ONLY AFTER successful comment persistence
    FeedMetricsCollector.recordInteraction(1);

    return comment;
  }

  getComments(postId: string): Comment[] {
    return this.comments.get(postId) ?? [];
  }

  async getCommentsAsync(postId: string): Promise<Comment[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getComments(postId);
        if (fromDb.length > 0) {
          this.comments.set(postId, fromDb);
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solara] Failed to fetch comments from Postgres:", err);
      }
    }
    return this.getComments(postId);
  }

  async followActor(
    followerActorType: SocialActorType,
    followerActorId: string,
    targetActorType: SocialActorType,
    targetActorId: string
  ): Promise<FollowerRelation> {
    const key = `${targetActorType}:${targetActorId}`;
    const relation: FollowerRelation = {
      id: `flw-${crypto.randomUUID()}`,
      followerActorType,
      followerActorId,
      targetActorType,
      targetActorId,
      createdAt: new Date(),
    };

    const list = this.followers.get(key) ?? [];
    list.push(relation);
    this.followers.set(key, list);

    if (this.repository) {
      await this.repository.addFollower(targetActorId, relation);
    }

    return relation;
  }

  getFollowers(targetActorType: SocialActorType, targetActorId: string): FollowerRelation[] {
    const key = `${targetActorType}:${targetActorId}`;
    return this.followers.get(key) ?? [];
  }

  /**
   * FEED-V1-01: removes all follow relations from follower → target.
   * In-memory only: `SocialRepositoryPort` exposes no follower removal yet.
   */
  public async unfollowActor(followerActorId: string, targetActorId: string): Promise<boolean> {
    let removed = false;
    for (const [key, rels] of this.followers.entries()) {
      const kept = rels.filter(
        (r) => !(r.followerActorId === followerActorId && r.targetActorId === targetActorId),
      );
      if (kept.length !== rels.length) {
        removed = true;
        if (kept.length > 0) this.followers.set(key, kept);
        else this.followers.delete(key);
      }
    }
    return removed;
  }

  /**
   * FEED-V1-02: author-only content edit. Persists via repository upsert when wired.
   */
  public async updatePost(postId: string, actorId: string, content: string): Promise<Post> {
    const post = this.posts.get(postId);
    if (!post || post.isDeleted) throw new Error(`Post [${postId}] non trouvé.`);
    if (post.actorId !== actorId) throw new Error(`Seul l'auteur peut modifier ce post.`);
    post.content = content;
    post.updatedAt = new Date();
    if (this.repository) {
      await this.repository.savePost(post);
    }
    return post;
  }

  /**
   * FEED-V1-02: author-only soft delete. Deleted posts are excluded from
   * `listFeed` and every downstream feed (multi-source, ForYou, MMR).
   * NOTE: the Postgres repository has no deleted-flag column yet — the flag
   * persists in-memory only until the solara_posts schema is extended.
   */
  public async deletePost(postId: string, actorId: string): Promise<Post> {
    const post = this.posts.get(postId);
    if (!post || post.isDeleted) throw new Error(`Post [${postId}] non trouvé.`);
    if (post.actorId !== actorId) throw new Error(`Seul l'auteur peut supprimer ce post.`);
    post.isDeleted = true;
    return post;
  }

  /**
   * FEED-V1-03: one vote per actor per poll. Persists via repository upsert when wired.
   */
  public async castPollVote(
    postId: string,
    optionId: string,
    actorId: string,
  ): Promise<{ options: PollOptionState[]; totalVotes: number }> {
    const post = this.posts.get(postId);
    if (!post || post.isDeleted) throw new Error(`Post [${postId}] non trouvé.`);
    if (post.publicationType !== "poll") throw new Error(`Le post [${postId}] n'est pas un sondage.`);
    const poll = (post.metadata?.poll ?? null) as PollState | null;
    if (!poll) throw new Error(`Sondage [${postId}] sans état de vote.`);
    if (poll.voters.includes(actorId)) throw new Error(`L'acteur [${actorId}] a déjà voté.`);
    const option = poll.options.find((o) => o.id === optionId);
    if (!option) throw new Error(`Option [${optionId}] inconnue pour le sondage [${postId}].`);
    option.votes += 1;
    poll.voters.push(actorId);
    if (this.repository) {
      await this.repository.savePost(post);
    }
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
    return { options: poll.options.map((o) => ({ ...o })), totalVotes };
  }

  /**
   * FEED-V1-04: repost (empty content) or quote (with comment). The new post
   * carries `metadata.repostOf`; the target's `repostCount` is incremented.
   */
  public async repostPost(
    actorType: SocialActorType,
    actorId: string,
    targetPostId: string,
    quoteComment?: string,
  ): Promise<Post> {
    const target = this.posts.get(targetPostId);
    if (!target || target.isDeleted) throw new Error(`Post [${targetPostId}] non trouvé.`);
    target.repostCount = (target.repostCount ?? 0) + 1;
    return this.createPost(
      actorType,
      actorId,
      target.targetType,
      target.targetId,
      quoteComment ?? "",
      "text",
      { repostOf: targetPostId },
    );
  }

  /**
   * FEED-V1-05: author-only pinning (`isPinned` is already honored by `FeedAggregator`).
   */
  public pinPost(postId: string, actorId: string): Post {
    const post = this.posts.get(postId);
    if (!post || post.isDeleted) throw new Error(`Post [${postId}] non trouvé.`);
    if (post.actorId !== actorId) throw new Error(`Seul l'auteur peut épingler ce post.`);
    post.isPinned = true;
    return post;
  }

  public unpinPost(postId: string, actorId: string): Post {
    const post = this.posts.get(postId);
    if (!post || post.isDeleted) throw new Error(`Post [${postId}] non trouvé.`);
    if (post.actorId !== actorId) throw new Error(`Seul l'auteur peut désépingler ce post.`);
    post.isPinned = false;
    return post;
  }

  /**
   * FEED-V1-06: user report → human moderation queue (first real producer).
   */
  public reportPost(postId: string, reporterActorId: string, reason: string): ReviewQueueItem {
    const post = this.posts.get(postId);
    if (!post || post.isDeleted) throw new Error(`Post [${postId}] non trouvé.`);
    return this.moderationQueue.enqueue(
      post.content,
      post.actorId,
      `Signalement par ${reporterActorId} : ${reason}`,
    );
  }

  /**
   * FEED-V1-07: per-user mute list (in-memory only: no repository table yet).
   * Consumable via `UserRecommendationProfile.mutedActorIds`.
   */
  public muteActor(userId: string, actorId: string): void {
    const set = this.mutedByUser.get(userId) ?? new Set<string>();
    set.add(actorId);
    this.mutedByUser.set(userId, set);
  }

  public unmuteActor(userId: string, actorId: string): boolean {
    const set = this.mutedByUser.get(userId);
    if (!set || !set.has(actorId)) return false;
    set.delete(actorId);
    return true;
  }

  public getMutedActors(userId: string): string[] {
    return Array.from(this.mutedByUser.get(userId) ?? []);
  }

  async getFollowersAsync(targetActorType: SocialActorType, targetActorId: string): Promise<FollowerRelation[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getFollowers(targetActorId);
        if (fromDb.length > 0) {
          const key = `${targetActorType}:${targetActorId}`;
          this.followers.set(key, fromDb);
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Solara] Failed to fetch followers from Postgres:", err);
      }
    }
    return this.getFollowers(targetActorType, targetActorId);
  }

  async addReaction(targetType: "post" | "comment", targetId: string, actorType: SocialActorType, actorId: string, type: ReactionModel["type"]): Promise<SocialReaction> {
    const reaction: SocialReaction = {
      id: `react-${crypto.randomUUID()}`,
      targetType,
      targetId,
      actorType,
      actorId,
      type,
      createdAt: new Date(),
    };

    if (this.repository) {
      await this.repository.saveReaction(targetType, targetId, reaction);
      if (targetType === "post") {
        await this.repository.incrementLikeCount(targetId, 1);
        const post = this.posts.get(targetId);
        if (post) {
          post.likeCount++;
        }
      }
    } else if (targetType === "post") {
      const post = this.posts.get(targetId);
      if (post) {
        post.likeCount++;
      }
    }

    // Telemetry: record interaction ONLY AFTER successful reaction persistence
    FeedMetricsCollector.recordInteraction(1);

    return reaction;
  }
}

/**
 * P3 Adapter: Converts a Solara Post model to a feed-engine FeedPost without unsafe type casting.
 */
export function postToFeedPost(post: Post): FeedPost {
  return {
    id: post.id,
    actorType: post.actorType,
    actorId: post.actorId,
    publicationType: post.publicationType,
    targetType: post.targetType,
    targetId: post.targetId,
    content: post.content,
    mediaUrls: post.mediaUrls,
    metadata: post.metadata,
    tags: Array.isArray(post.metadata?.tags) ? (post.metadata?.tags as string[]) : [],
    likeCount: post.likeCount || 0,
    commentsCount: post.commentsCount || 0,
    createdAt: post.createdAt,
  };
}

let sharedSocialService: SolaraSocialService | undefined;

/**
 * Server-wide shared SolaraSocialService (same lazy first-wins doctrine as
 * `getFeedService()` / `getAnonymizationOrchestrator()`): the HTTP server
 * (`src/start.ts`) initializes it once with the Postgres repository when the
 * dialect is postgres, in-memory otherwise. The BAC provider keeps building
 * its own per-composition instance so unit tests stay isolated — the provider
 * path is never booted in production, hence no data divergence at runtime.
 * Tests that need a pristine singleton must call `resetSharedSocialService()`.
 */
export function getSharedSocialService(repository?: SocialRepositoryPort): SolaraSocialService {
  sharedSocialService ??= new SolaraSocialService(repository);
  return sharedSocialService;
}

export function resetSharedSocialService(): void {
  sharedSocialService = undefined;
}
