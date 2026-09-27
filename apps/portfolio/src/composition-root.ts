/**
 * @apps/portfolio — Composition Root
 *
 * Single application wiring root: registers Portfolio domain services in Container,
 * instantiates Saga Workflow Engine, and mounts HTTP routes.
 */
import { Container, Router } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { InMemoryGuard } from "@mosaix/support";
import type { Vendable } from "./domain/vendable.js";
import type { VendableRepository } from "./domain/vendable-repository.js";
import { VendableWorkflow } from "./vendable-workflow.js";
import { InMemoryVendableRepository } from "./infrastructure/in-memory-vendable-repository.js";
import { PostgresVendableRepository } from "./infrastructure/postgres-vendable-repository.js";

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
    const body = req.body as { name?: string; type?: string };
    const typeMap = {
      product: "Product",
      service: "Service",
      digital_good: "DigitalProduct",
      digitalproduct: "DigitalProduct",
      experience: "Experience",
    } as const;
    const normalizedType =
      typeMap[(body.type ?? "").toLowerCase() as keyof typeof typeMap] ??
      (["Product", "Service", "DigitalProduct", "Experience"] as const).find(
        (t) => t === body.type,
      );
    if (!body?.name || !normalizedType) {
      return {
        statusCode: 400,
        body: { error: "Missing name or valid type" },
      };
    }
    const id = `vend_${Date.now()}`;
    const vendable: Vendable = {
      identity: {
        id,
        reference: `REF-${id}`,
        type: normalizedType,
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
 *
 * Repository selection mirrors `PortfolioServiceProvider.register`
 * (src/index.ts): explicit factory wins, else Postgres when a DatabasePort
 * is provided, else InMemory fallback (legacy callers pass no adapters).
 */
export interface PortfolioCompositionAdapters {
  vendableRepository?: () => VendableRepository;
  databasePort?: DatabasePort;
}

export function createPortfolioComposition(
  parentContainer?: Container,
  adapters: PortfolioCompositionAdapters = {},
): PortfolioAppComposition {
  const container = parentContainer ? parentContainer.createChild() : new Container();

  const vendableWorkflow = new VendableWorkflow();
  container.instance(VendableWorkflow, vendableWorkflow);

  let vendableRepository: VendableRepository;
  if (adapters.vendableRepository) {
    vendableRepository = adapters.vendableRepository();
  } else if (adapters.databasePort) {
    vendableRepository = new PostgresVendableRepository(adapters.databasePort);
  } else {
    InMemoryGuard.reportFallback("InMemoryVendableRepository", "missing DatabasePort in createPortfolioComposition");
    vendableRepository = new InMemoryVendableRepository();
  }

  const router = new Router();
  mountPortfolioRoutes(router, { vendableRepository, vendableWorkflow });

  return {
    container,
    router,
    vendableWorkflow,
    vendableRepository,
  };
}