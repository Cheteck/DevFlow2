export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface RichMessageMetadata {
  replyToMessageId?: string;
  forwardedFromConversationId?: string;
  threadId?: string;
  threadRepliesCount?: number;
  editedAt?: string;
  deletedAt?: string;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  attachments?: Array<{
    id: string;
    type: "image" | "file" | "audio" | "video";
    url: string;
    sizeBytes: number;
    filename: string;
  }>;
}

export interface BotCommandContext {
  conversationId: string;
  senderId: string;
  command: string; // e.g. "status"
  args: string[];
}

export interface BotCommandResult {
  handled: boolean;
  replyContent?: string;
}

export class BeamBotRouter {
  private handlers = new Map<string, (ctx: BotCommandContext) => Promise<BotCommandResult>>();

  registerCommand(command: string, handler: (ctx: BotCommandContext) => Promise<BotCommandResult>): void {
    this.handlers.set(command.toLowerCase(), handler);
  }

  async parseAndExecute(conversationId: string, senderId: string, text: string): Promise<BotCommandResult | null> {
    if (!text.startsWith("/")) return null;

    const parts = text.slice(1).trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const handler = this.handlers.get(command);
    if (!handler) {
      return {
        handled: true,
        replyContent: `Commande inconnue: /${command}. Tapez /help pour afficher les commandes disponibles.`,
      };
    }

    return handler({ conversationId, senderId, command, args });
  }
}
