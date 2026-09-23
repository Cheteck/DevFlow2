/**
 * @apps/portfolio — Composition Root
 *
 * Single application wiring root: registers Portfolio domain services in Container,
 * instantiates Saga Workflow Engine, and mounts HTTP routes.
 */
import { Container, Router } from "@mosaix/sdk";
import type { Vendable } from "./domain/vendable.js";
import type { VendableRepository } from "./domain/vendable-repository.js";
import { VendableWorkflow } from "./vendable-workflow.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";

export interface PortfolioAppComposition {
  container: Container;
  router: Router;
  vendableWorkflow: VendableWorkflow;
  vendableRepository: VendableRepository;
}

export interface PortfolioRouteDeps {
  vendableRepository: VendableRepository;
  vendableWorkflow: VendableWorkflow;
}

/**
 * Single source of truth for Portfolio HTTP routes.
 * Reused by the legacy `createPortfolioComposition` and the canonical
 * `createPortfolioApp` (src/index.ts) so route strings are defined once.
 */
export function mountPortfolioRoutes(
  router: Router,
  deps: PortfolioRouteDeps,
): void {
  const { vendableRepository, vendableWorkflow } = deps;

  router.get("/portfolio/catalog", async () => {
    const items = await vendableRepository.findAll();
    return {
      statusCode: 200,
      body: { catalog: items, count: items.length },
    };
  });

  router.post("/portfolio/vendables", async (req) => {
    const body = req.body as { name?: string; type?: "Product" | "Service" | "DigitalProduct" | "Experience" };
    if (!body?.name || !body?.type) {
      return {
        statusCode: 400,
        body: { error: "Missing name or type" },
      };
    }
    const typeMap = {
      product: "Product",
      service: "Service",
      digital_good: "DigitalProduct",
      experience: "Experience",
    } as const;
    const id = `vend_${Date.now()}`;
    const vendable: Vendable = {
      identity: {
        id,
        reference: `REF-${id}`,
        type: typeMap[body.type],
        status: "Draft",
      },
      content: {
        fr: { name: body.name },
      },
      characteristics: {
        attributes: {},
      },
      classification: {
        categories: [],
        tags: [],
        collections: [],
      },
      media: [],
      variants: [],
      relations: [],
    };
    await vendableRepository.save(vendable);
    return {
      statusCode: 201,
      body: vendable,
    };
  });

  router.post("/vendables/publish", async (req) => {
    const body = req.body as { id?: string } | undefined;
    const result = await vendableWorkflow.publish({
      vendableId: body?.id ?? "",
      status: "In Review",
      qualityPassed: true,
    });
    return {
      statusCode: result.success ? 200 : 400,
      body: result,
    };
  });
}

/**
 * Legacy sync composition root (kept for conformance + backward compat).
 * Delegates route wiring to `mountPortfolioRoutes` — no duplicated strings.
 */
export function createPortfolioComposition(parentContainer?: Container): PortfolioAppComposition {
  const container = parentContainer ? parentContainer.createChild() : new Container();

  const vendableWorkflow = new VendableWorkflow();
  container.instance(VendableWorkflow, vendableWorkflow);

  const vendableRepository = new InMemoryVendableRepository();

  const router = new Router();
  mountPortfolioRoutes(router, { vendableRepository, vendableWorkflow });

  return {
    container,
    router,
    vendableWorkflow,
    vendableRepository,
  };
}