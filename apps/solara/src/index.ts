/**
 * @apps/solara — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap, MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";

import { SolaraAppServiceProvider } from "./infrastructure/solara-service-provider.js";
import { SolaraSocialService, type SocialActorType } from "./domain/social.model.js";

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
    { id: "solara.feed.read", version: "1.0.0" },
  ],
  permissions: [
    "solara:post:create",
    "solara:feed:read",
  ],
  events: [
    "solara.post.created",
    "solara.post.commented",
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

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    this.innerProvider.boot(container, router);

    const kernel = container.resolve<RuntimeKernel>("kernel");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant: { organizationId: "default" } },
      kernel
    );

    const socialService = container.resolve(SolaraSocialService);
    app.provideCapability("solara.post.create", async (input) => {
      const inp = input as { actorType?: string; actorId?: string; targetType?: string; targetId?: string; content?: string };
      return socialService.createPost(
        (inp.actorType ?? "user") as SocialActorType,
        inp.actorId ?? "",
        (inp.targetType ?? "feed") as "feed" | "space" | "group" | "event",
        inp.targetId ?? "",
        inp.content ?? "",
      );
    });

    app.provideCapability("solara.feed.read", async () => {
      return socialService.listFeed("feed", "", undefined);
    });

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
  _adapters?: SolaraAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new SolaraServiceProvider(_adapters),
  });
}

// =============================================================
// SECTION 5 — DOMAIN EXPORTS
// =============================================================
export * from "./domain/social.model.js";
export * from "./domain/solara-moderation-pipeline.js";
export * from "./domain/solara-feed-realtime.js";
export * from "./domain/social-auto-share-plugin.js";


