import { Container, Router } from "@mosaix/sdk";
import { SolaraAppServiceProvider } from "./infrastructure/solara-service-provider";
import { SolaraSocialService } from "./domain/social.model";
import { SolaraController } from "./infrastructure/solara-controller";

export interface SolaraAppComposition {
  container: Container;
  router: Router;
  socialService: SolaraSocialService;
  controller: SolaraController;
}

export async function createSolaraComposition(parentContainer?: Container): Promise<SolaraAppComposition> {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const router = new Router();

  const provider = new SolaraAppServiceProvider();
  // register est async (feature flags) : sans await, resolve() verrait un
  // container vide et auto-instancierait des singletons fantômes.
  await provider.register(container);
  provider.boot(container, router);

  return {
    container,
    router,
    socialService: container.resolve(SolaraSocialService),
    controller: container.resolve(SolaraController),
  };
}
