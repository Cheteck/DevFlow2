/**
 * @shell/feed-store — legacy in-memory read fallback for the feed.
 *
 * Single writer doctrine: `FeedService` (SQLite, migration-owned schema) is
 * the only writer. This array only serves GET fallbacks when the database
 * holds no posts yet (fresh installs) and the compliance counters. No DDL,
 * no dual-write mirror here — the previous Proxy-based DB mirror wrote a
 * divergent schema and swallowed failures (see bypass audit F1).
 */
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

export const feedStore: FeedPost[] = [...DEFAULT_POSTS];
