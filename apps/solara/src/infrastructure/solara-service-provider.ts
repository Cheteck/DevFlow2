import { featureAsync } from "@mosaix/sdk";
import type { Container, ServiceProvider, Router, HttpRequest } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { CommandBus } from "@mosaix/commands";
import { SolaraSocialService } from "../domain/social.model.js";
import { SolaraController } from "./solara-controller.js";
import { PostgresSocialRepository } from "../domain/postgres-social-repository.js";
import { SolaraContentModeratorPlugin } from "@mosaix-plugin/solara-content-moderator";
import { CreatePostHandler, CreatePostCommand } from "../commands/create-post.command.js";

export interface SolaraAppServiceProviderOptions {
  databasePort?: DatabasePort;
}

export class SolaraAppServiceProvider implements ServiceProvider {
  constructor(private readonly options: SolaraAppServiceProviderOptions = {}) {}

  async register(container: Container): Promise<void> {
    let postgresRepo: PostgresSocialRepository | undefined;
    if (this.options.databasePort) {
      postgresRepo = new PostgresSocialRepository(this.options.databasePort);
      container.instance("postgresSocialRepository", postgresRepo);
    }

    container.singleton(SolaraSocialService, () => new SolaraSocialService(postgresRepo));

    // P1 Feature Flag: solara.moderation.ai_filter (default: true)
    const moderationEnabled = await featureAsync("solara.moderation.ai_filter", true);
    if (moderationEnabled) {
      container.singleton(SolaraContentModeratorPlugin, () => new SolaraContentModeratorPlugin());
    }

    container.singleton(SolaraController, () => new SolaraController(container.resolve(SolaraSocialService)));
    container.singleton(CreatePostHandler, () => new CreatePostHandler(container.resolve(SolaraSocialService)));

    if (!container.has(CommandBus)) {
      container.singleton(CommandBus, () => new CommandBus());
    }
    const commandBus = container.resolve(CommandBus);
    commandBus.register("CreatePost", container.resolve(CreatePostHandler));
    commandBus.register(CreatePostCommand.commandName, container.resolve(CreatePostHandler));
  }

  boot(container: Container, router?: Router): void {
    if (!router) return;
    const controller = container.resolve(SolaraController);

    const handleTypes = async (req: HttpRequest) => await controller.listPublicationTypes(req);
    const handleFeed = async (req: HttpRequest) => await controller.listFeed(req);
    const handleCreatePost = async (req: HttpRequest) => {
      const body = req.body as { type?: string } | undefined;
      if (body?.type === "product_showcase") {
        const showcaseEnabled = await featureAsync("solara.posts.showcase_type", true);
        if (!showcaseEnabled) {
          return { statusCode: 400, body: { error: "Product showcase posts are currently disabled by feature flag [solara.posts.showcase_type]." } };
        }
      }
      return await controller.createPost(req);
    };
    const handleComment = async (req: HttpRequest) => await controller.addComment(req);
    const handleReaction = async (req: HttpRequest) => {
      const reactionsEnabled = await featureAsync("solara.comments.reactions", true);
      if (!reactionsEnabled) {
        return { statusCode: 400, body: { error: "Reactions disabled by feature flag [solara.comments.reactions]." } };
      }
      return await controller.addReaction(req);
    };
    const handleFollowers = async (req: HttpRequest) => await controller.followActor(req);
    const handleUnfollow = async (req: HttpRequest) => await controller.unfollowActor(req);
    const handleUpdatePost = async (req: HttpRequest) => await controller.updatePost(req);
    const handleDeletePost = async (req: HttpRequest) => await controller.deletePost(req);
    const handleVote = async (req: HttpRequest) => await controller.castVote(req);
    const handleRepost = async (req: HttpRequest) => await controller.repost(req);
    const handleReport = async (req: HttpRequest) => await controller.reportPost(req);
    const handleAdTelemetry = async (req: HttpRequest) => await controller.trackAdTelemetry(req);

    // Standard /api/solara and /solara routing
    router.get("/api/solara/types", handleTypes);
    router.get("/solara/types", handleTypes);

    router.get("/api/solara/feed", handleFeed);
    router.get("/solara/feed", handleFeed);

    router.post("/api/solara/posts", handleCreatePost);
    router.post("/solara/posts", handleCreatePost);

    router.post("/api/solara/comments", handleComment);
    router.post("/solara/comments", handleComment);

    router.post("/api/solara/reactions", handleReaction);
    router.post("/solara/reactions", handleReaction);

    router.post("/api/solara/followers", handleFollowers);
    router.post("/solara/followers", handleFollowers);

    router.post("/api/solara/followers/unfollow", handleUnfollow);
    router.post("/solara/followers/unfollow", handleUnfollow);

    router.put("/api/solara/posts", handleUpdatePost);
    router.put("/solara/posts", handleUpdatePost);

    router.delete("/api/solara/posts", handleDeletePost);
    router.delete("/solara/posts", handleDeletePost);

    router.post("/api/solara/polls/vote", handleVote);
    router.post("/solara/polls/vote", handleVote);

    router.post("/api/solara/reposts", handleRepost);
    router.post("/solara/reposts", handleRepost);

    router.post("/api/solara/reports", handleReport);
    router.post("/solara/reports", handleReport);

    router.post("/api/solara/telemetry/ad", handleAdTelemetry);
    router.post("/solara/telemetry/ad", handleAdTelemetry);
  }

  shutdown(_container: Container): void {
    // Graceful release of resources if needed
  }
}