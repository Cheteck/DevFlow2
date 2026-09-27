import { Container, Router } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { BeamAppServiceProvider } from "./infrastructure/beam-service-provider";
import { BeamMessagingService } from "./domain/messaging.model";
import { BeamMessagingController } from "./infrastructure/beam-controller";

export interface BeamAppComposition {
  container: Container;
  router: Router;
  messagingService: BeamMessagingService;
  controller: BeamMessagingController;
}

export interface BeamCompositionAdapters {
  databasePort?: DatabasePort;
}

export function createBeamComposition(
  parentContainer?: Container,
  adapters: BeamCompositionAdapters = {},
): BeamAppComposition {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const router = new Router();

  const provider = new BeamAppServiceProvider(
    adapters.databasePort ? { databasePort: adapters.databasePort } : {},
  );
  provider.register(container);
  provider.boot(container, router);

  return {
    container,
    router,
    messagingService: container.resolve(BeamMessagingService),
    controller: container.resolve(BeamMessagingController),
  };
}
