/**
 * @apps/spaces — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap, MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";

import { SpacesAppServiceProvider } from "./infrastructure/spaces-service-provider.js";
import { SpaceService } from "./domain/space.model.js";
import { ActingAsSpaceEngine } from "./domain/acting-as-space.js";
import { SpaceTemplateRegistry, type SpaceTemplateType } from "./domain/space-template.js";
import { SpaceController } from "./infrastructure/space-controller.js";
import { spacesEventPayloadSchemas } from "./events/spaces-events.js";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@apps/spaces",
  name: "MosaiX Spaces & Modular Pages",
  version: "1.0.0",
  domain: { name: "spaces" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "spaces.space.create", version: "1.0.0" },
    { id: "spaces.module.toggle", version: "1.0.0" },
  ],
  permissions: [
    "spaces:space:create:tenant",
    "spaces:space:manage:tenant",
    "spaces:space:read:tenant",
  ],
  events: [
    "spaces.space.created",
    "spaces.module.enabled",
    "spaces.module.disabled",
  ],
  experience: {
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export type SpacesAdapters = {
  databasePort?: DatabasePort;
};

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class SpacesServiceProvider {
  private readonly innerProvider: SpacesAppServiceProvider;

  constructor(adapters: SpacesAdapters = {}) {
    this.innerProvider = new SpacesAppServiceProvider(
      adapters.databasePort ? { databasePort: adapters.databasePort } : {},
    );
  }

  register(container: Container): void {
    this.innerProvider.register(container);
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    this.innerProvider.boot(container, router);

    const kernel = container.resolve<RuntimeKernel>("kernel");
    const tenant = container.resolve<TenantIdentity>("tenant");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant },
      kernel
    );

    const spaceService = container.resolve(SpaceService);
    app.provideCapability("spaces.space.create", async (input) => {
      const inp = input as { name: string; ownerUserId: string; templateId?: string; category?: string };
      const space = spaceService.createSpaceFromTemplate(
        inp.name,
        (inp.templateId ?? "business") as SpaceTemplateType,
        inp.ownerUserId,
        "default",
      );
      return space;
    });

    app.provideCapability("spaces.module.toggle", async (input) => {
      const inp = input as { spaceId: string; capability: string };
      return spaceService.addCapability(inp.spaceId, inp.capability);
    });

    app.registerEventSchema({
      type: "spaces.space.created",
      version: "1.0.0",
      schema: spacesEventPayloadSchemas["spaces.space.created"] as unknown as Record<string, unknown>,
    });
    app.registerEventSchema({
      type: "spaces.module.enabled",
      version: "1.0.0",
      schema: spacesEventPayloadSchemas["spaces.module.enabled"] as unknown as Record<string, unknown>,
    });
    app.registerEventSchema({
      type: "spaces.module.disabled",
      version: "1.0.0",
      schema: spacesEventPayloadSchemas["spaces.module.disabled"] as unknown as Record<string, unknown>,
    });

    return app;
  }
}

// =============================================================
// SECTION 4 — BOOTSTRAP FACTORY
// =============================================================
export async function createSpacesApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  _adapters?: SpacesAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new SpacesServiceProvider(),
  });
}

// Legacy Composition Root compatibility
export function createSpaceComposition(parentContainer?: Container) {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const router = new Router();

  const provider = new SpacesAppServiceProvider();
  provider.register(container);
  provider.boot(container, router);

  return {
    container,
    router,
    spaceService: container.resolve(SpaceService),
    actingEngine: container.resolve(ActingAsSpaceEngine),
    templateRegistry: container.resolve(SpaceTemplateRegistry),
    controller: container.resolve(SpaceController),
  };
}

// =============================================================
// SECTION 5 — DOMAIN EXPORTS
// =============================================================
export * from "./domain/space.model.js";
export * from "./domain/space-template.js";
export * from "./domain/acting-as-space.js";
export * from "./domain/domain-state-machine.js";
export * from "./domain/space-usage-audit.js";
export * from "./domain/spaces-analytics-scim.js";
export * from "./infrastructure/space-controller.js";


