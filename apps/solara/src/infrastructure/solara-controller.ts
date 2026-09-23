import { Controller, type HttpRequest, type HttpResponse } from "@mosaix/sdk";
import { SolaraSocialService, type SocialActorType, type DefaultPublicationType } from "../domain/social.model";

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
    const posts = await this.socialService.listFeedAsync(targetType, targetId, publicationType);
    return this.json({ posts });
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
      const post = this.socialService.createPost(
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
