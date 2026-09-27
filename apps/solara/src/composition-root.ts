import { Container, Router } from "@mosaix/sdk";
import { SolaraAppServiceProvider } from "./infrastructure/solara-service-provider";
import { SolaraSocialService } from "./domain/social.model";
import { SolaraController } from "./infrastructure/solara-controller";
import type { DatabasePort } from "@mosaix/ports-database";

export interface SolaraAppComposition {
  container: Container;
  router: Router;
  socialService: SolaraSocialService;
  controller: SolaraController;
}

export interface SolaraCompositionOptions {
  databasePort?: DatabasePort;
  parentContainer?: Container;
}

export async function createSolaraComposition(options: SolaraCompositionOptions = {}): Promise<SolaraAppComposition> {
  const container = options.parentContainer ? options.parentContainer.createChild() : new Container();
  const router = new Router();

  const provider = new SolaraAppServiceProvider(
    options.databasePort ? { databasePort: options.databasePort } : {}
  );
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