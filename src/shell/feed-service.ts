/**
 * @mosaix/shell — Feed Service with Keyset Pagination
 */

import type { SQLiteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";

export interface ShellFeedItem {
  id: string;
  type: string;
  author: string;
  title?: string;
  content: string;
  category?: string;
  tags?: string[];
  likes: number;
  timestamp: number;
  spaceId?: string;
}

export interface PaginatedFeedResponse {
  items: ShellFeedItem[];
  nextCursor?: number | null;
  hasMore: boolean;
  total?: number;
}

export class FeedService {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async addItem(item: Omit<ShellFeedItem, "id" | "timestamp" | "likes"> & { likes?: number }): Promise<ShellFeedItem> {
    const fullItem: ShellFeedItem = {
      id: `feed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      likes: item.likes ?? 0,
      ...item,
    };

    await this.db.execute(
      `INSERT INTO shell_feed (id, type, author, title, content, category, tags, likes, timestamp, space_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullItem.id,
        fullItem.type,
        fullItem.author,
        fullItem.title ?? null,
        fullItem.content,
        fullItem.category ?? "general",
        JSON.stringify(fullItem.tags || []),
        fullItem.likes,
        fullItem.timestamp,
        fullItem.spaceId ?? null,
      ]
    );

    return fullItem;
  }

  async getFeed(options: {
    category?: string;
    limit?: number;
    cursor?: number; // timestamp cursor for keyset pagination
  } = {}): Promise<PaginatedFeedResponse> {
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const params: unknown[] = [];
    let sql = `SELECT id, type, author, title, content, category, tags, likes, timestamp, space_id as spaceId FROM shell_feed`;
    const conditions: string[] = [];

    if (options.category && options.category !== "all") {
      conditions.push(`category = ?`);
      params.push(options.category);
    }

    if (options.cursor) {
      conditions.push(`timestamp < ?`);
      params.push(options.cursor);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = await this.db.query<Record<string, unknown>>(sql, params);
    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const items: ShellFeedItem[] = resultRows.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      author: String(r.author),
      title: r.title ? String(r.title) : undefined,
      content: String(r.content),
      category: r.category ? String(r.category) : undefined,
      tags: typeof r.tags === "string" ? JSON.parse(r.tags) : [],
      likes: Number(r.likes || 0),
      timestamp: Number(r.timestamp),
      spaceId: r.spaceId ? String(r.spaceId) : undefined,
    }));

    const nextCursor = items.length > 0 && hasMore ? items[items.length - 1].timestamp : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async seedInitialFeedIfEmpty(): Promise<void> {
    const countResult = await this.db.query<{ count: number }>(`SELECT count(*) as count FROM shell_feed`);
    if (countResult && countResult[0] && Number(countResult[0].count) > 0) {
      return;
    }

    const defaultItems = [
      {
        type: "post",
        author: "Camille Dupont (Citadelle)",
        title: "Bienvenue sur l'infrastructure MosaiX IJIDeals",
        content: "L'écosystème modulaire Bounded Application Components (BAC) est en ligne avec 9 contextes intégrés.",
        category: "general",
        tags: ["welcome", "mosaix"],
        likes: 12,
      },
      {
        type: "product",
        author: "Boutique Solidaire (Portfolio)",
        title: "Panier Maraîcher Bio de Saison",
        content: "Nouveau lot de produits locaux disponibles à la réservation immédiate via Commerce & Booking.",
        category: "commerce",
        tags: ["bio", "local"],
        likes: 8,
      },
      {
        type: "event",
        author: "Collectif Solidarité",
        title: "Atelier Réparation & Échange de Compétences",
        content: "Rendez-vous samedi à 14h dans l'espace communautaire. Inscription sans frais.",
        category: "solidarity",
        tags: ["entraide", "atelier"],
        likes: 19,
      },
    ];

    for (const item of defaultItems) {
      await this.addItem(item);
    }
  }
}
