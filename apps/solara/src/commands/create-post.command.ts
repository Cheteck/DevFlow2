import type { Command, CommandHandler } from "@mosaix/commands";
import type { Post, SocialActorType, DefaultPublicationType } from "../domain/social.model.js";
import { SolaraSocialService } from "../domain/social.model.js";

export interface CreatePostPayload {
  actorType: SocialActorType;
  actorId: string;
  targetType: "feed" | "space" | "group" | "event";
  targetId: string;
  content: string;
  publicationType?: DefaultPublicationType;
  metadata?: Record<string, unknown>;
  mediaUrls?: string[];
}

export class CreatePostCommand implements Command<CreatePostPayload> {
  static readonly commandName = "solara.post.create";
  readonly commandName = "CreatePost";

  constructor(public readonly payload: CreatePostPayload) {}
}

export class CreatePostHandler implements CommandHandler<CreatePostCommand, Post> {
  constructor(private readonly socialService: SolaraSocialService) {}

  async handle(command: CreatePostCommand): Promise<Post> {
    const p = command.payload;
    return this.socialService.createPost(
      p.actorType,
      p.actorId,
      p.targetType,
      p.targetId,
      p.content,
      p.publicationType ?? "text",
      p.metadata,
      p.mediaUrls ?? []
    );
  }
}
