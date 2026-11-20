/**
 * @ijideals/developer-portal — Composition Root
 *
 * Point de câblage unique : services domaine + adaptateurs + routes HTTP.
 * Aucune règle métier ici.
 *
 * Persistance : aucun fallback en mémoire hors tests (invariant repo).
 * L'adaptateur Postgres et sa migration arrivent dans la tranche suivante ;
 * en attendant, un `catalogRepository` explicite est exigé (fail-fast).
 */

import { Container, Router } from "@mosaix/sdk";
import { DeveloperPortalService } from "./domain/developer-portal-service.js";
import type { CatalogRepository } from "./domain/catalog-repository.js";
import {
  DeveloperPortalController,
  mountDeveloperPortalRoutes,
} from "./infrastructure/developer-portal-controller.js";

export interface DeveloperPortalAdapters {
  /** Repository de projection du catalogue (explicite, requis hors tests). */
  catalogRepository?: () => CatalogRepository;
}

export interface DeveloperPortalComposition {
  container: Container;
  router: Router;
  service: DeveloperPortalService;
  catalogRepository: CatalogRepository;
}

/**
 * Legacy sync composition — conservée pour la conformance et les appelants
 * synchrones.
 */
export function createDeveloperPortalComposition(
  adapters: DeveloperPortalAdapters = {},
  parentContainer?: Container,
): DeveloperPortalComposition {
  const catalogRepository = adapters.catalogRepository?.();
  if (!catalogRepository) {
    throw new Error(
      "[DeveloperPortalAdapters] catalogRepository requis : passez catalogRepository (tests ou adaptateur Postgres).",
    );
  }

  const container = new Container(parentContainer);
  const service = new DeveloperPortalService(catalogRepository);
  const router = new Router();

  container.instance("catalogRepository", catalogRepository);
  container.instance(DeveloperPortalService, service);

  mountDeveloperPortalRoutes(router, new DeveloperPortalController(service));

  return { container, router, service, catalogRepository };
}
