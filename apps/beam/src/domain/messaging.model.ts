import { featureAsync } from "@mosaix/sdk";

export interface ConversationModel {
  id: string;
  type: "direct" | "group";
  participants: string[];
  createdAt: string;
}

export interface MessageModel {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sentAt: string;
}

export interface BeamMessagingRepositoryPort {
  saveConversation(conversation: ConversationModel): Promise<void>;
  getConversation(id: string): Promise<ConversationModel | null>;
  listConversations(limit?: number): Promise<ConversationModel[]>;
  saveMessage(message: MessageModel): Promise<void>;
  getMessages(conversationId: string, limit?: number): Promise<MessageModel[]>;
}

export class BeamMessagingService {
  private conversations = new Map<string, ConversationModel>();
  private messages: MessageModel[] = [];

  constructor(private readonly repository?: BeamMessagingRepositoryPort) {}

  async createConversation(type: "direct" | "group", participants: string[]): Promise<ConversationModel> {
    // P1 Feature Flag: beam.messaging.group_chats (default: true)
    if (type === "group") {
      const groupChatsEnabled = await featureAsync("beam.messaging.group_chats", true);
      if (!groupChatsEnabled) {
        throw new Error("Group chats are currently disabled by feature flag [beam.messaging.group_chats].");
      }
    }

    const conv: ConversationModel = {
      id: `conv-${Math.random().toString(36).substring(2, 9)}`,
      type,
      participants,
      createdAt: new Date().toISOString(),
    };
    this.conversations.set(conv.id, conv);

    if (this.repository) {
      void this.repository.saveConversation(conv).catch((err: unknown) => {
        console.error("[Beam] Failed to persist conversation to Postgres:", err);
      });
    }

    return conv;
  }

  async getConversationAsync(id: string): Promise<ConversationModel | null> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getConversation(id);
        if (fromDb) {
          this.conversations.set(fromDb.id, fromDb);
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Beam] Failed to fetch conversation from Postgres:", err);
      }
    }
    return this.conversations.get(id) ?? null;
  }

  async sendMessage(conversationId: string, senderId: string, content: string): Promise<MessageModel> {
    const conv = await this.getConversationAsync(conversationId);
    if (!conv) {
      throw new Error(`Conversation [${conversationId}] not found.`);
    }

    const msg: MessageModel = {
      id: `msg-${Math.random().toString(36).substring(2, 9)}`,
      conversationId,
      senderId,
      content,
      sentAt: new Date().toISOString(),
    };
    this.messages.push(msg);

    if (this.repository) {
      await this.repository.saveMessage(msg);
    }

    return msg;
  }

  listConversations(participantId: string): ConversationModel[] {
    return Array.from(this.conversations.values()).filter((c) => c.participants.includes(participantId));
  }

  async listConversationsAsync(participantId: string): Promise<ConversationModel[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.listConversations(100);
        if (fromDb.length > 0) {
          for (const c of fromDb) {
            this.conversations.set(c.id, c);
          }
        }
      } catch (err: unknown) {
        console.error("[Beam] Failed to fetch conversations from Postgres:", err);
      }
    }
    return this.listConversations(participantId);
  }

  getMessages(conversationId: string): MessageModel[] {
    return this.messages.filter((m) => m.conversationId === conversationId);
  }

  async getMessagesAsync(conversationId: string): Promise<MessageModel[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getMessages(conversationId);
        if (fromDb.length > 0) {
          const others = this.messages.filter((m) => m.conversationId !== conversationId);
          this.messages = [...others, ...fromDb];
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("[Beam] Failed to fetch messages from Postgres:", err);
      }
    }
    return this.getMessages(conversationId);
  }
}
