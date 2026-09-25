import { Controller, type HttpRequest, type HttpResponse } from "@mosaix/sdk";
import { SolaraSocialService, type SocialActorType, type DefaultPublicationType } from "../domain/social.model";
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
  constructor(private socialService: SolaraSocialService = new SolaraSocialService()) {
    super();
  }

  async listPublicationTypes(_req: HttpRequest): Promise<HttpResponse> {
    const types = this.socialService.publicationTypeRegistry.listPublicationTypes();
    return this.json({ publicationTypes: types });
  }

  async listFeed(req: HttpRequest): Promise<HttpResponse> {
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
  }

  async trackAdTelemetry(req: HttpRequest): Promise<HttpResponse> {
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
  }

  async createPost(req: HttpRequest): Promise<HttpResponse> {
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
  }

  async addComment(req: HttpRequest): Promise<HttpResponse> {
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
  }

  async followActor(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as {
      followerActorType: SocialActorType;
      followerActorId: string;
      targetActorType: SocialActorType;
      targetActorId: string;
    };

    if (!body || !body.followerActorType || !body.followerActorId || !body.targetActorType || !body.targetActorId) {
      return this.badRequest("followerActorType, followerActorId, targetActorType and targetActorId are required.");
    }

    const relation = this.socialService.followActor(
      body.followerActorType,
      body.followerActorId,
      body.targetActorType,
      body.targetActorId
    );
    return this.created({ message: "Abonnement enregistré avec succès", relation });
  }
}
