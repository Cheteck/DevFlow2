/**
 * @apps/subscription — Canonical Application Entry Point with Service Provider
 */

import { Container, Router, createBoundedAppBootstrap, MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";

import { SubscriptionService } from "./domain/subscription.service.js";

export const MANIFEST = {
  type: "application",
  id: "@apps/subscription",
  name: "Subscription & Billing",
  version: "0.1.0",
  domain: { name: "subscription" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  requires: [
    { id: "@apps/citadelle", version: "^1.0.0" },
  ],
  capabilities: [
    { id: "subscription.plan.list", version: "1.0.0" },
    { id: "subscription.user.get", version: "1.0.0" },
  ],
  permissions: [
    "subscription:plan:read:tenant",
    "subscription:user:read:tenant",
  ],
  events: {
    publishes: ["subscription.created", "subscription.renewed", "subscription.cancelled"],
    subscribes: ["identity.user.created"],
  },
  routes: {
    prefix: "/subscription",
  },
} as const;

export type SubscriptionAdapters = {
  databasePort?: DatabasePort;
};

export class SubscriptionServiceProvider {
  private subscriptionService: SubscriptionService;

  constructor(adapters: SubscriptionAdapters = {}) {
    this.subscriptionService = new SubscriptionService(adapters.databasePort);
  }

  register(container: Container): void {
    container.bind("subscriptionService", () => this.subscriptionService);
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    const kernel = container.resolve<RuntimeKernel>("kernel");
    const tenant = container.resolve<TenantIdentity>("tenant");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant },
      kernel
    );

    app.provideCapability("subscription.plan.list", async () => {
      return this.subscriptionService.listPlans();
    });

    app.provideCapability("subscription.user.get", async (input) => {
      const inp = input as { userId?: string };
      return inp?.userId ? this.subscriptionService.getUserSubscription(inp.userId) : null;
    });

    router.get("/health", () => ({ statusCode: 200, body: { status: "ok", app: MANIFEST.id } }));

    return app;
  }
}

export async function createSubscriptionApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  adapters?: SubscriptionAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new SubscriptionServiceProvider(adapters),
  });
}

// Domain & Presentation exports
export * from "./domain/subscription.js";
export * from "./domain/subscription.service.js";
export * from "./domain/subscription-billing-engine.js";
export * from "./domain/subscription-trial-revenue.js";
export * from "./presentation/subscription-view.js";
