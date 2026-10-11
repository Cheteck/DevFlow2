/**
 * @apps/portfolio — Composition Root
 *
 * Single application wiring root: registers Portfolio domain services in Container,
 * instantiates Saga Workflow Engine, and mounts HTTP routes.
 */
import { Container, Router } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { PortfolioService } from "./domain/portfolio-service.js";
import type { VendableRepository } from "./domain/vendable-repository.js";
import { VendableWorkflow } from "./vendable-workflow.js";
import { PostgresVendableRepository } from "./infrastructure/postgres-vendable-repository.js";
import {
  PortfolioController,
  mountPortfolioControllerRoutes,
} from "./infrastructure/portfolio-controller.js";

export interface PortfolioAppComposition {
  container: Container;
  router: Router;
  vendableWorkflow: VendableWorkflow;
  vendableRepository: VendableRepository;
}

export interface PortfolioRouteDeps {
  portfolioService: PortfolioService;
  vendableRepository: VendableRepository;
  vendableWorkflow: VendableWorkflow;
}

/**
 * Single source of truth for Portfolio HTTP routes.
 * Reused by the legacy `createPortfolioComposition` and the canonical
 * `createPortfolioApp` (src/index.ts) so route strings are defined once.
 * All routes go through `PortfolioController` (Guard.authorize + error mapping).
 */
export function mountPortfolioRoutes(
  router: Router,
  deps: PortfolioRouteDeps,
): void {
  const controller = new PortfolioController(
    deps.portfolioService,
    deps.vendableRepository,
    deps.vendableWorkflow,
  );
  mountPortfolioControllerRoutes(router, controller);
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
    // Pas de stockage en memoire hors tests : exiger un DatabasePort
    // (Postgres) ou un repository explicite (tests uniquement).
    throw new Error(
      "[createPortfolioComposition] DatabasePort requis : passez databasePort (Postgres) ou vendableRepository (tests uniquement).",
    );
  }

  const router = new Router();
  mountPortfolioRoutes(router, {
    portfolioService: new PortfolioService(vendableRepository),
    vendableRepository,
    vendableWorkflow,
  });

  return {
    container,
    router,
    vendableWorkflow,
    vendableRepository,
  };
}