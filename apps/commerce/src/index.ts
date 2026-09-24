/**
 * @apps/commerce — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap } from "@mosaix/sdk";
import { MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";

import { OrderRepository } from "./infrastructure/order.repository.js";
import { OrderService } from "./domain/order.service.js";
import { CommerceController } from "./infrastructure/commerce-controller.js";
import { CommerceAppServiceProvider } from "./infrastructure/commerce-service-provider.js";
import { commerceEventPayloadSchemas } from "./events/commerce-events.js";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@apps/commerce",
  name: "Commerce & Orders",
  version: "1.0.0",
  domain: { name: "commerce" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  capabilities: [
    { id: "commerce.order.create", version: "1.0.0" },
    { id: "commerce.order.read", version: "1.0.0" },
  ],
  permissions: [
    "commerce:order:create:tenant",
    "commerce:order:read:tenant",
  ],
  events: [
    "commerce.order.created",
  ],
  experience: {
    frontend: { entrypoint: "./frontend/src/index.ts" },
  },
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export interface CommerceAdapters {
  orderRepository?: () => OrderRepository;
}

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class CommerceServiceProvider {
  private readonly innerProvider: CommerceAppServiceProvider;

  constructor(adapters: CommerceAdapters = {}) {
    this.innerProvider = new CommerceAppServiceProvider(
      adapters.orderRepository?.()
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

    const orderService = container.resolve(OrderService);
    app.provideCapability("commerce.order.create", async (input) => {
      const inp = input as { userId: string; vendableId: string; amount?: number };
      return orderService.createOrder(inp);
    });
    app.provideCapability("commerce.order.read", async (input) => {
      const inp = input as { id: string };
      return orderService.getOrderById(inp.id);
    });

    app.registerEventSchema({
      type: "commerce.order.created",
      version: "1.0.0",
      schema: commerceEventPayloadSchemas["commerce.order.created"],
    });

    return app;
  }
}

// =============================================================
// SECTION 4 — BOOTSTRAP FACTORY
// =============================================================
export async function createCommerceApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  adapters?: CommerceAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new CommerceServiceProvider(adapters),
  });
}

// Legacy Composition Root compatibility
export function createCommerceComposition(parentContainer?: Container) {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const repository = new OrderRepository();
  const service = new OrderService(repository);
  const controller = new CommerceController(service);

  container.instance(OrderRepository, repository);
  container.instance(OrderService, service);
  container.instance(CommerceController, controller);

  const router = new Router();
  router.post("/orders", (req) => controller.createOrder(req));
  router.get("/orders/:id", (req) => controller.getOrder(req));

  return { container, router, controller, service, orderRepository: repository };
}

export * from "./domain/order.model.js";
export * from "./domain/order.service.js";
export * from "./domain/order-state-machine.js";
export * from "./domain/commerce-payment-intent.js";
export * from "./domain/commerce-offer.model.js";
export * from "./infrastructure/order.repository.js";


