/**
 * @apps/beam — PostgreSQL adapter for BeamMessagingService.
 * Implements persistence for conversations and messages.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { ConversationModel, MessageAttachment, MessageModel } from "../domain/messaging.model";
import type { EncryptedMessagePayload } from "../domain/beam-e2e-crypto.js";

/** Les 12 colonnes canoniques de `beam_messages` (migration `beam.messaging.v1.001`). */
const MESSAGE_COLUMNS = [
  "id",
  "conversationId",
  "senderId",
  "content",
  "replyToMessageId",
  "threadId",
  "reactions",
  "attachments",
  "encryptedPayload",
  "editedAt",
  "deletedAt",
  "sentAt",
] as const;

const MESSAGE_SELECT = MESSAGE_COLUMNS.map((c) => `"${c}"`).join(", ");

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

function toIsoNullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseJsonObject(value: unknown): Record<string, string[]> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value as Record<string, string[]>;
  if (typeof value === "string") {
    if (value.length === 0) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string[]>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseJsonArray<T>(value: unknown): T[] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    if (value.length === 0) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseJsonPayload(value: unknown): EncryptedMessagePayload | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value as EncryptedMessagePayload;
  if (typeof value === "string") {
    if (value.length === 0) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null ? (parsed as EncryptedMessagePayload) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toJsonParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function hydrateMessage(row: Record<string, unknown>, fallbackConversationId: string): MessageModel {
  return {
    id: asString(row["id"]),
    conversationId: asString(row["conversationId"], fallbackConversationId),
    senderId: asString(row["senderId"]),
    content: asString(row["content"]),
    sentAt: toIso(row["sentAt"]),
    replyToMessageId: asNullableString(row["replyToMessageId"]),
    threadId: asNullableString(row["threadId"]),
    reactions: parseJsonObject(row["reactions"]),
    attachments: parseJsonArray<MessageAttachment>(row["attachments"]),
    encryptedPayload: parseJsonPayload(row["encryptedPayload"]),
    editedAt: toIsoNullable(row["editedAt"]),
    deletedAt: toIsoNullable(row["deletedAt"]),
  };
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

  /**
   * NOTE (backlog BEAM-SQL-PARTICIPANT-FILTER) : le filtre participant reste
   * appliqué en mémoire par `BeamMessagingService.listConversationsAsync`
   * (après LIMIT). Un filtre SQL exigerait un opérateur JSON non portable :
   * `participants::jsonb ? $1` (Postgres) vs `json_each`/`LIKE` (SQLite),
   * alors que `DatabasePort` + `SelectQueryBuilder` n'exposent que
   * `=,!=,>,>=,<,<=,LIKE,IN,IS NULL` — voir `packages/ports/database`.
   * Options : table `beam_participants` normalisée (hors périmètre) ou
   * opérateur JSON dans la grammaire/port.
   */
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
      `INSERT INTO beam_messages (${MESSAGE_SELECT})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         "conversationId" = $2, "senderId" = $3, content = $4,
         "replyToMessageId" = $5, "threadId" = $6, reactions = $7,
         attachments = $8, "encryptedPayload" = $9, "editedAt" = $10,
         "deletedAt" = $11, "sentAt" = $12`,
      [
        message.id,
        message.conversationId,
        message.senderId,
        message.content,
        message.replyToMessageId ?? null,
        message.threadId ?? null,
        toJsonParam(message.reactions),
        toJsonParam(message.attachments),
        toJsonParam(message.encryptedPayload),
        message.editedAt ?? null,
        message.deletedAt ?? null,
        message.sentAt ?? new Date().toISOString(),
      ],
    );
  }

  async getMessages(conversationId: string, limit = 50): Promise<MessageModel[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${MESSAGE_SELECT} FROM beam_messages WHERE "conversationId" = $1 ORDER BY "sentAt" DESC LIMIT $2`,
      [conversationId, safeLimit],
    );
    return rows.map((r) => hydrateMessage(r, conversationId));
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
          ...(typeof parsed.title === "string" ? { title: parsed.title } : {}),
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
        ...(typeof parsed.title === "string" ? { title: parsed.title } : {}),
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
