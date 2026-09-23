/**
 * @apps/beam — PostgreSQL adapter for BeamMessagingService.
 * Implements persistence for conversations and messages.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { ConversationModel, MessageModel } from "../domain/messaging.model";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

export class PostgresMessagingRepository {
  constructor(private readonly db: DatabasePort) {}

  async saveConversation(conversation: ConversationModel): Promise<void> {
    await this.db.query(
      `INSERT INTO beam_conversations (id, type, participants, "createdAt", data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         type = $2, participants = $3, data = $5`,
      [
        conversation.id,
        conversation.type,
        JSON.stringify(conversation.participants),
        conversation.createdAt ?? new Date().toISOString(),
        JSON.stringify(conversation),
      ],
    );
  }

  async getConversation(id: string): Promise<ConversationModel | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, type, participants, "createdAt", data FROM beam_conversations WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    if (!row) return null;
    return this.hydrateConversation(row);
  }

  async listConversations(limit = 100): Promise<ConversationModel[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, type, participants, "createdAt", data FROM beam_conversations ORDER BY "createdAt" DESC LIMIT $1`,
      [safeLimit],
    );
    return rows.map((r) => this.hydrateConversation(r));
  }

  async saveMessage(message: MessageModel): Promise<void> {
    await this.db.query(
      `INSERT INTO beam_messages (id, "conversationId", "senderId", content, "sentAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         content = $4, "sentAt" = $5`,
      [message.id, message.conversationId, message.senderId, message.content, message.sentAt ?? new Date().toISOString()],
    );
  }

  async getMessages(conversationId: string, limit = 50): Promise<MessageModel[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "conversationId", "senderId", content, "sentAt" FROM beam_messages WHERE "conversationId" = $1 ORDER BY "sentAt" DESC LIMIT $2`,
      [conversationId, safeLimit],
    );
    return rows.map((r): MessageModel => ({
      id: asString(r["id"]),
      conversationId: asString(r["conversationId"], conversationId),
      senderId: asString(r["senderId"]),
      content: asString(r["content"]),
      sentAt: toIso(r["sentAt"]),
    }));
  }

  private hydrateConversation(row: Record<string, unknown>): ConversationModel {
    const data = row["data"];
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data) as Partial<ConversationModel>;
        return {
          id: asString(parsed.id, asString(row["id"])),
          type: parsed.type === "group" ? "group" : "direct",
          participants: Array.isArray(parsed.participants) ? parsed.participants : asStringArray(row["participants"]),
          createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : toIso(row["createdAt"]),
        };
      } catch {
        // fall through to manual hydrate
      }
    } else if (typeof data === "object" && data !== null) {
      const parsed = data as Partial<ConversationModel>;
      return {
        id: asString(parsed.id, asString(row["id"])),
        type: parsed.type === "group" ? "group" : "direct",
        participants: Array.isArray(parsed.participants) ? parsed.participants : asStringArray(row["participants"]),
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : toIso(row["createdAt"]),
      };
    }
    const type = asString(row["type"], "direct");
    return {
      id: asString(row["id"]),
      type: type === "group" ? "group" : "direct",
      participants: asStringArray(row["participants"]),
      createdAt: toIso(row["createdAt"]),
    };
  }
}
