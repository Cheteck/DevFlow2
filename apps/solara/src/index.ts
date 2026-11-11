/**
 * @apps/solara — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap, MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";

import { SolaraAppServiceProvider } from "./infrastructure/solara-service-provider.js";
import { SolaraSocialService, type SocialActorType } from "./domain/social.model.js";
import {
  solaraEventPayloadSchemas,
  type SolaraPostPublishedPayload,
  type SolaraCommentCreatedPayload,
  type SolaraReactionAddedPayload,
  type SolaraFollowerAddedPayload,
} from "./events/solara-events.js";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@apps/solara",
  name: "MosaiX Solara Social & Content",
  version: "1.0.0",
  domain: { name: "social" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "solara.post.create", version: "1.0.0" },
    { id: "solara.comment.add", version: "1.0.0" },
    { id: "solara.reaction.add", version: "1.0.0" },
    { id: "solara.follower.add", version: "1.0.0" },
    { id: "solara.feed.read", version: "1.0.0" },
  ],
  permissions: [
    "solara:post:create",
    "solara:comment:add",
    "solara:reaction:add",
    "solara:follower:add",
    "solara:feed:read",
    "solara:moderate:content",
  ],
  events: [
    "solara.post.published",
    "solara.comment.created",
    "solara.reaction.added",
    "solara.follower.added",
  ],
  experience: {
    appCard: {
      title: "Solara Social Feed",
      icon: "☀️",
      description: "Fil d'actualité social, publications et interactions de communauté",
    },
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export type SolaraAdapters = { databasePort?: DatabasePort };

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class SolaraServiceProvider {
  private readonly innerProvider: SolaraAppServiceProvider;

  constructor(adapters: SolaraAdapters = {}) {
    this.innerProvider = new SolaraAppServiceProvider(
      adapters.databasePort ? { databasePort: adapters.databasePort } : {},
    );
  }

  async register(container: Container): Promise<void> {
    await this.innerProvider.register(container);
  }

  boot(container: Container, router: Router): MosaixApp {
    this.innerProvider.boot(container, router);

    const kernel = container.resolve<RuntimeKernel>("kernel");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant: { organizationId: "default" } },
      kernel
    );

    const socialService = container.resolve(SolaraSocialService);
    app.provideCapability("solara.post.create", async (input) => {
      const inp = input as { actorType?: string; actorId?: string; targetType?: string; targetId?: string; content?: string };
      const post = await socialService.createPost(
        (inp.actorType ?? "user") as SocialActorType,
        inp.actorId ?? "",
        (inp.targetType ?? "feed") as "feed" | "space" | "group" | "event",
        inp.targetId ?? "",
        inp.content ?? "",
      );
      const payload: SolaraPostPublishedPayload = {
        postId: post.id,
        actorId: post.actorId,
        publicationType: post.publicationType,
        targetType: post.targetType,
        targetId: post.targetId,
        createdAt: post.createdAt.toISOString(),
      };
      await app.publish("solara.post.published", "1.0.0", payload);
      return post;
    });

    app.provideCapability("solara.comment.add", async (input) => {
      const inp = input as { postId?: string; actorType?: string; actorId?: string; content?: string };
      const comment = await socialService.addComment(
        inp.postId ?? "",
        (inp.actorType ?? "user") as SocialActorType,
        inp.actorId ?? "",
        inp.content ?? "",
      );
      const payload: SolaraCommentCreatedPayload = {
        commentId: comment.id,
        postId: comment.postId,
        actorId: comment.actorId,
        createdAt: comment.createdAt.toISOString(),
      };
      await app.publish("solara.comment.created", "1.0.0", payload);
      return comment;
    });

    app.provideCapability("solara.reaction.add", async (input) => {
      const inp = input as { targetType?: string; targetId?: string; actorType?: string; actorId?: string; type?: string };
      const reaction = await socialService.addReaction(
        (inp.targetType ?? "post") as "post" | "comment",
        inp.targetId ?? "",
        (inp.actorType ?? "user") as SocialActorType,
        inp.actorId ?? "",
        (inp.type ?? "like") as "like" | "love" | "laugh" | "surprised" | "sad" | "angry",
      );
      const payload: SolaraReactionAddedPayload = {
        reactionId: reaction.id,
        targetType: reaction.targetType,
        targetId: reaction.targetId,
        actorId: reaction.actorId,
        type: reaction.type,
      };
      await app.publish("solara.reaction.added", "1.0.0", payload);
      return reaction;
    });

    app.provideCapability("solara.follower.add", async (input) => {
      const inp = input as { followerActorType?: string; followerActorId?: string; targetActorType?: string; targetActorId?: string };
      const relation = await socialService.followActor(
        (inp.followerActorType ?? "user") as SocialActorType,
        inp.followerActorId ?? "",
        (inp.targetActorType ?? "user") as SocialActorType,
        inp.targetActorId ?? "",
      );
      const payload: SolaraFollowerAddedPayload = {
        followerActorId: relation.followerActorId,
        targetActorId: relation.targetActorId,
      };
      await app.publish("solara.follower.added", "1.0.0", payload);
      return relation;
    });

    app.provideCapability("solara.feed.read", async () => {
      return socialService.listFeed("feed", "", undefined);
    });

    for (const type of Object.keys(solaraEventPayloadSchemas) as Array<keyof typeof solaraEventPayloadSchemas>) {
      app.registerEventSchema({
        type,
        version: "1.0.0",
        schema: solaraEventPayloadSchemas[type] as unknown as Record<string, unknown>,
      });
    }

    return app;
  }

  shutdown(container: Container): void {
    this.innerProvider.shutdown(container);
  }
}

// =============================================================
// SECTION 4 — BOOTSTRAP FACTORY
// =============================================================
export async function createSolaraApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  adapters?: SolaraAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new SolaraServiceProvider(adapters),
  });
}

// =============================================================
// SECTION 5 — DOMAIN EXPORTS
// =============================================================
export * from "./domain/social.model.js";
export * from "./domain/solara-moderation-pipeline.js";
export * from "./domain/solara-feed-realtime.js";
export * from "./domain/social-auto-share-plugin.js";
export * from "./events/solara-events.js";
export * from "./presentation/solara-view.js";