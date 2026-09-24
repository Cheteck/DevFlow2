/**
 * @apps/beam — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap } from "@mosaix/sdk";
import { MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";

import { BeamAppServiceProvider } from "./infrastructure/beam-service-provider.js";
import { BeamMessagingService } from "./domain/messaging.model.js";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@apps/beam",
  name: "Beam Messaging & Communication",
  version: "1.0.0",
  domain: { name: "messaging" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "beam.message.send", version: "1.0.0" },
    { id: "beam.conversation.list", version: "1.0.0" },
  ],
  permissions: [
    "beam:message:send",
    "beam:conversation:read",
  ],
  events: [
    "beam.message.sent",
    "beam.conversation.created",
  ],
  experience: {
    appCard: {
      title: "Beam Messenger",
      icon: "💬",
      description: "Messagerie instantanée temps réel et salons collaboratifs",
    },
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export type BeamAdapters = {
  databasePort?: DatabasePort;
};

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class BeamServiceProvider {
  private readonly innerProvider: BeamAppServiceProvider;

  constructor(adapters: BeamAdapters = {}) {
    this.innerProvider = new BeamAppServiceProvider(
      adapters.databasePort ? { databasePort: adapters.databasePort } : {},
    );
  }

  register(container: Container): void {
    this.innerProvider.register(container);
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    this.innerProvider.boot(container, router);

    const kernel = container.resolve<RuntimeKernel>("kernel");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant: { organizationId: "default" } },
      kernel
    );

    const messagingService = container.resolve(BeamMessagingService);
    app.provideCapability("beam.message.send", async (input) => {
      const inp = input as { conversationId: string; senderId: string; content: string };
      return messagingService.sendMessage(inp.conversationId, inp.senderId, inp.content);
    });

    app.provideCapability("beam.conversation.list", async (input) => {
      const inp = input as { participantId?: string };
      return messagingService.listConversations(inp.participantId ?? "");
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
export async function createBeamApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  _adapters?: BeamAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new BeamServiceProvider(_adapters),
  });
}

// =============================================================
// SECTION 5 — DOMAIN EXPORTS
// =============================================================
export * from "./domain/messaging.model.js";
export * from "./domain/beam-e2e-crypto.js";
export * from "./domain/beam-rich-messaging.js";
export * from "./domain/beam-push-storage-search.js";


