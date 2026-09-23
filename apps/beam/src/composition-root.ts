import { Container, Router } from "@mosaix/sdk";
import { BeamAppServiceProvider } from "./infrastructure/beam-service-provider";
import { BeamMessagingService } from "./domain/messaging.model";
import { BeamMessagingController } from "./infrastructure/beam-controller";

export interface BeamAppComposition {
  container: Container;
  router: Router;
  messagingService: BeamMessagingService;
  controller: BeamMessagingController;
}

export function createBeamComposition(parentContainer?: Container): BeamAppComposition {
  const container = parentContainer ? parentContainer.createChild() : new Container();
  const router = new Router();

  const provider = new BeamAppServiceProvider();
  provider.register(container);
  provider.boot(container, router);

  return {
    container,
    router,
    messagingService: container.resolve(BeamMessagingService),
    controller: container.resolve(BeamMessagingController),
  };
}
