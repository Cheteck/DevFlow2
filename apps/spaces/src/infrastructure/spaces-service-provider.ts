import type { Container, ServiceProvider, Router, HttpRequest } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { CommandBus } from "@mosaix/commands";
import { SpaceService } from "../domain/space.model.js";
import { ActingAsSpaceEngine } from "../domain/acting-as-space.js";
import { SpaceTemplateRegistry } from "../domain/space-template.js";
import { SpaceController } from "./space-controller.js";
import { PostgresSpaceRepository } from "./postgres-space-repository.js";
import { CreateSpaceHandler } from "../commands/create-space.command.js";

export interface SpacesAppServiceProviderOptions {
  databasePort?: DatabasePort;
}

export class SpacesAppServiceProvider implements ServiceProvider {
  constructor(private readonly options: SpacesAppServiceProviderOptions = {}) {}

  register(container: Container): void {
    const postgresRepo = this.options.databasePort
      ? new PostgresSpaceRepository(this.options.databasePort)
      : undefined;

    const spaceService = new SpaceService(postgresRepo);
    const actingEngine = new ActingAsSpaceEngine();
    const templateRegistry = new SpaceTemplateRegistry();
    const controller = new SpaceController(spaceService, actingEngine);

    if (postgresRepo) {
      container.instance("postgresSpaceRepository", postgresRepo);
    }

    container.instance(SpaceService, spaceService);
    container.instance(ActingAsSpaceEngine, actingEngine);
    container.instance(SpaceTemplateRegistry, templateRegistry);
    container.instance(SpaceController, controller);

    container.singleton(CreateSpaceHandler, () => new CreateSpaceHandler(container.resolve(SpaceService)));

    if (!container.has(CommandBus)) {
      container.singleton(CommandBus, () => new CommandBus());
    }
    const commandBus = container.resolve(CommandBus);
    commandBus.register("CreateSpace", container.resolve(CreateSpaceHandler));
  }

  boot(container: Container, router?: Router): void {
    if (!router) return;
    const controller = container.resolve(SpaceController);

    router.get("/spaces/templates", async (req: HttpRequest) => await controller.listTemplates(req));
    router.get("/spaces", async (req: HttpRequest) => await controller.listSpaces(req));
    router.post("/spaces", async (req: HttpRequest) => await controller.createSpace(req));
    router.post("/spaces/capabilities", async (req: HttpRequest) => await controller.addCapability(req));
    router.post("/spaces/members", async (req: HttpRequest) => await controller.addTeamMember(req));
    router.post("/spaces/acting-as", async (req: HttpRequest) => await controller.actAsSpace(req));
  }
}
