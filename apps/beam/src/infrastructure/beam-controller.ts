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

    // `title` est persisté via la colonne `data` JSON (round-trip hydrate),
    // sans colonne dédiée — voir `PostgresMessagingRepository`.
    const conv = await this.messagingService.createConversation(body.type, body.participants, body.title);
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
    const body = req.body as {
      conversationId: string;
      senderId: string;
      content: string;
      replyToMessageId?: string | null;
      threadId?: string | null;
      reactions?: Record<string, string[]> | null;
      attachments?: Array<{
        id: string;
        type: "image" | "file" | "audio" | "video";
        url: string;
        sizeBytes: number;
        filename: string;
      }> | null;
      encryptedPayload?: {
        algorithm: "AES-256-GCM";
        ivHex: string;
        ciphertextHex: string;
        authTagHex: string;
        senderPublicKeyHex: string;
      } | null;
    };
    if (!body || !body.conversationId || !body.senderId || !body.content) {
      return this.badRequest("conversationId, senderId and content are required.");
    }

    try {
      const msg = await this.messagingService.sendMessage(body.conversationId, body.senderId, body.content, {
        ...(body.replyToMessageId !== undefined ? { replyToMessageId: body.replyToMessageId } : {}),
        ...(body.threadId !== undefined ? { threadId: body.threadId } : {}),
        ...(body.reactions !== undefined ? { reactions: body.reactions } : {}),
        ...(body.attachments !== undefined ? { attachments: body.attachments } : {}),
        ...(body.encryptedPayload !== undefined ? { encryptedPayload: body.encryptedPayload } : {}),
      });
      return this.created({ message: "Message envoyé", sentMessage: msg });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.badRequest(errorMsg);
    }
  }
}
