import type { Command, CommandHandler } from "@mosaix/commands";
import type { MessageModel } from "../domain/messaging.model.js";
import { BeamMessagingService } from "../domain/messaging.model.js";

export interface SendMessagePayload {
  conversationId: string;
  senderId: string;
  content: string;
}

export class SendMessageCommand implements Command<SendMessagePayload> {
  static readonly commandName = "beam.message.send";
  readonly commandName = SendMessageCommand.commandName;

  constructor(public readonly payload: SendMessagePayload) {}
}

export class SendMessageHandler implements CommandHandler<SendMessageCommand, MessageModel> {
  constructor(private readonly messagingService: BeamMessagingService) {}

  async handle(command: SendMessageCommand): Promise<MessageModel> {
    const { conversationId, senderId, content } = command.payload;
    return this.messagingService.sendMessage(conversationId, senderId, content);
  }
}
