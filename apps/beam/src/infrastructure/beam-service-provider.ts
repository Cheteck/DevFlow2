import type { Container, ServiceProvider, Router, HttpRequest } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { BeamMessagingService } from "../domain/messaging.model.js";
import { BeamMessagingController } from "./beam-controller.js";
import { SendMessageHandler } from "../commands/send-message.command.js";
import { PostgresMessagingRepository } from "./postgres-messaging-repository.js";

export interface BeamAppServiceProviderOptions {
  databasePort?: DatabasePort;
}

export class BeamAppServiceProvider implements ServiceProvider {
  constructor(private readonly options: BeamAppServiceProviderOptions = {}) {}

  register(container: Container): void {
    let postgresRepo: PostgresMessagingRepository | undefined;
    if (this.options.databasePort) {
      postgresRepo = new PostgresMessagingRepository(this.options.databasePort);
      container.instance("postgresMessagingRepository", postgresRepo);
    }

    container.singleton(BeamMessagingService, () => new BeamMessagingService(postgresRepo));
    container.singleton(BeamMessagingController, () => new BeamMessagingController(container.resolve(BeamMessagingService)));
    container.singleton(SendMessageHandler, () => new SendMessageHandler(container.resolve(BeamMessagingService)));
  }

  boot(container: Container, router?: Router): void {
    if (!router) return;
    const controller = container.resolve(BeamMessagingController);

    // Standard API routes with /api/beam and backward compatible /beam
    const handleListConversations = (req: HttpRequest) => controller.listConversations(req);
    const handleCreateConversation = (req: HttpRequest) => controller.createConversation(req);
    const handleGetMessages = (req: HttpRequest) => controller.getMessages(req);
    const handleSendMessage = (req: HttpRequest) => controller.sendMessage(req);

    router.get("/api/beam/conversations", handleListConversations);
    router.get("/beam/conversations", handleListConversations);

    router.post("/api/beam/conversations", handleCreateConversation);
    router.post("/beam/conversations", handleCreateConversation);

    router.get("/api/beam/messages", handleGetMessages);
    router.get("/beam/messages", handleGetMessages);

    router.post("/api/beam/messages", handleSendMessage);
    router.post("/beam/messages", handleSendMessage);
  }

  shutdown(_container: Container): void {
    // Graceful release of resources if needed
  }
}
