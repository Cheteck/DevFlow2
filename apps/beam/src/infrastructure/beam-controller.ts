import { Controller, type HttpRequest, type HttpResponse } from "@mosaix/sdk";
import { BeamMessagingService } from "../domain/messaging.model";

export class BeamMessagingController extends Controller {
  constructor(private messagingService: BeamMessagingService = new BeamMessagingService()) {
    super();
  }

  async listConversations(req: HttpRequest): Promise<HttpResponse> {
    const participantId = req.query?.["participantId"] ?? "";
    const conversations = await this.messagingService.listConversationsAsync(participantId);
    return this.json({ conversations });
  }

  async createConversation(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as { title: string; type: "direct" | "group"; participants: string[] };
    if (!body || !body.title || !body.type || !body.participants) {
      return this.badRequest("title, type and participants are required.");
    }

    const conv = await this.messagingService.createConversation(body.type, body.participants);
    return this.created({ message: "Conversation créée avec succès", conversation: conv });
  }

  async getMessages(req: HttpRequest): Promise<HttpResponse> {
    const conversationId = req.params?.["conversationId"] ?? req.query?.["conversationId"];
    if (!conversationId) {
      return this.badRequest("conversationId is required.");
    }
    const messages = await this.messagingService.getMessagesAsync(conversationId);
    return this.json({ messages });
  }

  async sendMessage(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as { conversationId: string; senderId: string; content: string };
    if (!body || !body.conversationId || !body.senderId || !body.content) {
      return this.badRequest("conversationId, senderId and content are required.");
    }

    try {
      const msg = await this.messagingService.sendMessage(body.conversationId, body.senderId, body.content);
      return this.created({ message: "Message envoyé", sentMessage: msg });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.badRequest(errorMsg);
    }
  }
}
