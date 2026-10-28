import { Controller, type HttpRequest, type HttpResponse } from "@mosaix/sdk";
import { Guard, type UserContext } from "@mosaix/security";
import { SolaraSocialService, type SocialActorType, type DefaultPublicationType } from "../domain/social.model.js";
import {
  FeedRanker,
  SponsoredPostInjector,
  FeedAggregator,
  ForYouRecommendationEngine,
  TrendingVelocityRanker,
  ContentSafetyFilter,
  SponsorshipTelemetry,
  FeedGeneratorRegistry
} from "@mosaix/feed-engine";

export class SolaraController extends Controller {
  private readonly guard = new Guard();

  constructor(private socialService: SolaraSocialService = new SolaraSocialService()) {
    super();
  }

  private toUserContext(req: HttpRequest): UserContext | null {
    const principal = req.principal;
    if (!principal) return null;
    return {
      sub: principal.sub,
      roles: principal.roles ?? [],
      permissions: principal.permissions ?? [],
    };
  }

  private denialOrError(err: unknown): HttpResponse<{ error: string }> {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("Unauthorized")) {
      return this.json({ error: message }, 401);
    }
    if (message.startsWith("Forbidden")) {
      return this.json({ error: message }, 403);
    }
    return this.internalError(message);
  }

  async listPublicationTypes(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(this.toUserContext(req), "solara:feed:read");
      const types = this.socialService.publicationTypeRegistry.listPublicationTypes();
      return this.json({ publicationTypes: types });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async listFeed(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(this.toUserContext(req), "solara:feed:read");
      const targetType = req.query?.["targetType"];
    const targetId = req.query?.["targetId"];
    const publicationType = req.query?.["publicationType"];
    const mode = req.query?.["mode"] || "for_you"; // "for_you" | "trending" | "chronological" | "media" | "ranked"
    const withSponsored = req.query?.["sponsored"] !== "false";
    const limit = req.query?.["limit"] ? parseInt(req.query["limit"], 10) : 20;
    const afterCursor = req.query?.["afterCursor"];

    let posts = await this.socialService.listFeedAsync(targetType, targetId, publicationType);

    // Filter unsafe spam/abusive posts automatically
    posts = ContentSafetyFilter.filterUnsafe(posts);

    // Apply selected feed algorithm
    if (mode === "for_you") {
      posts = ForYouRecommendationEngine.generateForYouFeed(posts, {
        userId: "current-user-1",
        followedSpaceIds: ["space-commerce", "space-events"],
        interestTags: ["artisanat", "booking", "musique", "tech"]
      });
    } else if (mode === "trending") {
      posts = TrendingVelocityRanker.rankByTrending(posts);
    } else if (mode === "media") {
      const mediaGenerator = FeedGeneratorRegistry.resolve("media_only");
      posts = mediaGenerator ? mediaGenerator(posts, {}) : posts;
    } else if (mode === "ranked" || req.query?.["ranked"] === "true") {
      posts = FeedRanker.rank(posts, { currentUserFollowedSpaces: [] });
    }

    // Inject high-precision sponsored items if requested
    if (withSponsored) {
      const sponsoredPool = this.socialService.getSponsoredPool();
      posts = SponsoredPostInjector.inject(posts, sponsoredPool, { interval: 4, maxSponsoredPosts: 2 });
    }

    const paginated = FeedAggregator.aggregatePaginated(posts, [], { limit, afterCursor });

    return this.json({
      feedMode: mode,
      availableModes: ["for_you", "trending", "chronological", "media"],
      posts: paginated.items,
      hasMore: paginated.hasMore,
      nextCursor: paginated.nextCursor
    });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async trackAdTelemetry(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(this.toUserContext(req), "solara:moderate:content");
      const body = req.body as {
      campaignId: string;
      postId: string;
      viewerActorId?: string;
      eventType: "impression" | "click" | "cta_conversion";
    };

    if (!body || !body.campaignId || !body.postId || !body.eventType) {
      return this.badRequest("campaignId, postId, and eventType are required.");
    }

    SponsorshipTelemetry.track({
      campaignId: body.campaignId,
      postId: body.postId,
      viewerActorId: body.viewerActorId || "anonymous",
      eventType: body.eventType,
      timestamp: new Date()
    });

    const metrics = SponsorshipTelemetry.getMetrics(body.campaignId);
    return this.json({ tracked: true, currentMetrics: metrics });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async createPost(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(this.toUserContext(req), "solara:post:create");
      const body = req.body as {
      actorType: SocialActorType;
      actorId: string;
      targetType: "feed" | "space" | "group" | "event";
      targetId: string;
      content: string;
      publicationType?: DefaultPublicationType;
      metadata?: Record<string, unknown>;
      mediaUrls?: string[];
    };

    if (!body || !body.actorType || !body.actorId || !body.targetType || !body.targetId || !body.content) {
      return this.badRequest("actorType, actorId, targetType, targetId and content are required.");
    }

    try {
      const post = await this.socialService.createPost(
        body.actorType,
        body.actorId,
        body.targetType,
        body.targetId,
        body.content,
        body.publicationType ?? "text",
        body.metadata,
        body.mediaUrls ?? []
      );
      return this.created({ message: "Publication créée avec succès", post });
    } catch (err: unknown) {

      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.badRequest(errorMsg);
    }
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async addComment(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(this.toUserContext(req), "solara:comment:add");
      const body = req.body as {
      postId: string;
      actorType: SocialActorType;
      actorId: string;
      content: string;
    };

    if (!body || !body.postId || !body.actorType || !body.actorId || !body.content) {
      return this.badRequest("postId, actorType, actorId and content are required.");
    }

    try {
      const comment = await this.socialService.addComment(body.postId, body.actorType, body.actorId, body.content);
      return this.created({ message: "Commentaire ajouté", comment });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.badRequest(errorMsg);
    }
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async addReaction(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(this.toUserContext(req), "solara:reaction:add");
      const body = req.body as {
      targetType: "post" | "comment";
      targetId: string;
      actorType: SocialActorType;
      actorId: string;
      type: "like" | "love" | "laugh" | "surprised" | "sad" | "angry";
    };

    if (!body || !body.targetType || !body.targetId || !body.actorType || !body.actorId || !body.type) {
      return this.badRequest("targetType, targetId, actorType, actorId and type are required.");
    }

    try {
      const reaction = await this.socialService.addReaction(body.targetType, body.targetId, body.actorType, body.actorId, body.type);
      return this.created({ message: "Réaction ajoutée", reaction });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.badRequest(errorMsg);
    }
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async followActor(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(this.toUserContext(req), "solara:follower:add");
      const body = req.body as {
      followerActorType: SocialActorType;
      followerActorId: string;
      targetActorType: SocialActorType;
      targetActorId: string;
    };

    if (!body || !body.followerActorType || !body.followerActorId || !body.targetActorType || !body.targetActorId) {
      return this.badRequest("followerActorType, followerActorId, targetActorType and targetActorId are required.");
    }

    const relation = await this.socialService.followActor(
      body.followerActorType,
      body.followerActorId,
      body.targetActorType,
      body.targetActorId
    );
    return this.created({ message: "Abonnement enregistré avec succès", relation });
    } catch (err) {
      return this.denialOrError(err);
    }
  }
}