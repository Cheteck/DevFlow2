import { Container, Router } from "@mosaix/sdk";
import { SolidarityAppServiceProvider } from "./infrastructure/solidarity-service-provider.js";
import { SolidarityService } from "./infrastructure/solidarity-service.js";

export interface SolidarityComposition {
  container: Container;
  router: Router;
  solidarityService: SolidarityService;
}

export function createSolidarityComposition(parentContainer?: Container): SolidarityComposition {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const router = new Router();

  const provider = new SolidarityAppServiceProvider();
  provider.register(container);
  provider.boot(container, router);

  return {
    container,
    router,
    solidarityService: container.resolve(SolidarityService),
  };
}
