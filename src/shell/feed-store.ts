import type { DatabasePort } from "@mosaix/ports-database";

export interface FeedPost {
  id: string;
  author: string;
  authorRole: string;
  authorAvatar: string;
  bacSource: string;
  content: string;
  timestamp: string;
  likes: number;
}

const DEFAULT_POSTS: FeedPost[] = [
  {
    id: "post-1",
    author: "Elena Rostova",
    authorRole: "Directrice des Opérations",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    bacSource: "solidarity",
    content: "Lancement du plan d'urgence grand froid. Mobilisation générale des centres logistiques et réquisition des espaces d'hébergement temporaires.",
    timestamp: "Il y a 10 min",
    likes: 12
  },
  {
    id: "post-2",
    author: "Marc Vasseur",
    authorRole: "Secrétaire Général",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    bacSource: "imperia",
    content: "Publication de la nouvelle directive de conformité inter-applications. Tous les BACs doivent impérativement déclarer leurs outboxes d'ici la fin du sprint.",
    timestamp: "Il y a 45 min",
    likes: 5
  },
  {
    id: "post-3",
    author: "Système Automatisé",
    authorRole: "Orchestrateur Global",
    authorAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80",
    bacSource: "commerce",
    content: "Rapport journalier : 142 commandes traitées, taux de succès du workflow Checkout à 99.4%. Aucune anomalie détectée sur la passerelle bancaire.",
    timestamp: "Il y a 2h",
    likes: 24
  }
];

const rawFeedStore: FeedPost[] = [];
let db: DatabasePort | undefined;

export const feedStore = new Proxy(rawFeedStore, {
  get(target, prop, receiver) {
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    const success = Reflect.set(target, prop, value, receiver);
    if (success && typeof prop === "string" && !isNaN(Number(prop))) {
      // Index-based set (e.g. unshift or push added an item)
      const post = value as FeedPost;
      if (post && post.id && db) {
        savePostToDb(post).catch(err => {
          console.error("[FeedStore] Failed to save post to SQLite:", err);
        });
      }
    }
    return success;
  }
});

async function savePostToDb(post: FeedPost): Promise<void> {
  if (!db) return;
  await db.query(
    `INSERT INTO shell_feed (id, author, author_role, author_avatar, bac_source, content, timestamp, likes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       author = excluded.author,
       author_role = excluded.author_role,
       author_avatar = excluded.author_avatar,
       bac_source = excluded.bac_source,
       content = excluded.content,
       timestamp = excluded.timestamp,
       likes = excluded.likes`,
    [
      post.id,
      post.author,
      post.authorRole,
      post.authorAvatar,
      post.bacSource,
      post.content,
      post.timestamp,
      post.likes
    ]
  );
}

export async function initFeedStore(database: DatabasePort): Promise<void> {
  db = database;
  
  // Create table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS shell_feed (
      id TEXT PRIMARY KEY,
      author TEXT,
      author_role TEXT,
      author_avatar TEXT,
      bac_source TEXT,
      content TEXT,
      timestamp TEXT,
      likes INTEGER
    )
  `);

  // Load posts
  const rows = await db.query<Record<string, unknown>>(`SELECT * FROM shell_feed`);
  if (rows.length === 0) {
    // Seed default posts
    for (const post of DEFAULT_POSTS) {
      await savePostToDb(post);
      rawFeedStore.push(post);
    }
  } else {
    const posts = rows.map((r): FeedPost => ({
      id: String(r["id"]),
      author: String(r["author"] || ""),
      authorRole: String(r["author_role"] || ""),
      authorAvatar: String(r["author_avatar"] || ""),
      bacSource: String(r["bac_source"] || ""),
      content: String(r["content"] || ""),
      timestamp: String(r["timestamp"] || ""),
      likes: Number(r["likes"] || 0)
    }));
    rawFeedStore.length = 0;
    rawFeedStore.push(...posts);
  }
}
