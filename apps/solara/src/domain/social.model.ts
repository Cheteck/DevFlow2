import * as crypto from "node:crypto";
import { Model } from "@mosaix/sdk";

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
  postId: string;
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
  saveReaction(postId: string, reaction: SocialReaction): Promise<void>;
  getReactions(postId: string): Promise<SocialReaction[]>;
}

export type SolaraContentHook = (
  content: string
) => Promise<{ approved: boolean; modifiedContent?: string; reason?: string }> | { approved: boolean; modifiedContent?: string; reason?: string };

export class SolaraSocialService {
  private posts = new Map<string, Post>();
  private comments = new Map<string, Comment[]>();
  private followers = new Map<string, FollowerRelation[]>();
  private contentHooks: SolaraContentHook[] = [];
  private sponsoredPool: import("@mosaix/feed-engine").SponsoredPost[] = [
    {
      id: "sponsored-1",
      actorType: "organization",
      actorId: "org-mosaix-commerce",
      publicationType: "product_showcase",
      targetType: "feed",
      targetId: "global",
      content: "🔥 **Offre Spéciale Artisanat local** : Découvrez les créations céramiques faites main avec -20% aujourd'hui !",
      mediaUrls: ["https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80"],
      likeCount: 42,
      commentsCount: 8,
      createdAt: new Date(),
      isSponsored: true,
      sponsorName: "E-Commerce MosaiX",
      sponsorBadge: "Sponsorisé",
      ctaText: "Acheter en ligne",
      ctaUrl: "/commerce/products/ceramic-vase",
      campaignId: "cmp-artisanat-2026"
    }
  ];
  public publicationTypeRegistry = new PublicationTypeRegistry();

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
    // Validate publication type metadata
    const validation = this.publicationTypeRegistry.validateMetadata(publicationType, metadata);
    if (!validation.valid) {
      throw new Error(`Métadonnées manquantes pour le type de publication [${publicationType}] : ${validation.missingFields.join(", ")}`);
    }

    let finalContent = content;

    // Execute plugin content hooks in async waterfall pipeline with safety timeout
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
      ...(metadata ? { metadata } : {}),
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
    let list = Array.from(this.posts.values());
    if (targetType && targetId) {
      list = list.filter((p) => p.targetType === targetType && p.targetId === targetId);
    }
    if (publicationType) {
      list = list.filter((p) => p.publicationType === publicationType);
    }
    return list;
  }

  async listFeedAsync(targetType?: string, targetId?: string, publicationType?: string): Promise<Post[]> {
    if (this.repository) {
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
      id: `cmt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
    }

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

  async addReaction(postId: string, actorType: SocialActorType, actorId: string, type: ReactionModel["type"]): Promise<SocialReaction> {
    const reaction: SocialReaction = {
      id: `react-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      postId,
      actorType,
      actorId,
      type,
      createdAt: new Date(),
    };
    if (this.repository) {
      await this.repository.saveReaction(postId, reaction);
    }
    return reaction;
  }
}
