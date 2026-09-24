import type { Post } from "./social.model.js";

export type FeedSortStrategy = "chronological" | "engagement" | "trending";

export class FeedScoringEngine {
  static score(post: Post, now: number = Date.now()): number {
    const ageHours = Math.max(1, (now - post.createdAt.getTime()) / (1000 * 60 * 60));
    const likes = post.metrics.likesCount ?? 0;
    const comments = post.metrics.commentsCount ?? 0;
    const engagement = likes * 2 + comments * 5;

    // Decay gravity formula: engagement / (ageHours ^ 1.5)
    return engagement / Math.pow(ageHours, 1.5);
  }

  static sortPosts(posts: Post[], strategy: FeedSortStrategy = "chronological"): Post[] {
    const sorted = [...posts];
    if (strategy === "chronological") {
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    const now = Date.now();
    return sorted.sort((a, b) => this.score(b, now) - this.score(a, now));
  }
}

export interface OpenGraphMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export class OpenGraphEmbedParser {
  static extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) ?? [];
  }

  static parseDummy(url: string): OpenGraphMetadata {
    return {
      url,
      title: "Shared Article",
      description: "Preview metadata for shared link.",
      siteName: new URL(url).hostname,
    };
  }
}

export type GroupPrivacyLevel = "public" | "private" | "secret";

export interface SolaraGroup {
  id: string;
  spaceId: string;
  name: string;
  privacy: GroupPrivacyLevel;
  memberIds: Set<string>;
}

export class SolaraGroupManager {
  private groups = new Map<string, SolaraGroup>();

  createGroup(group: SolaraGroup): void {
    this.groups.set(group.id, group);
  }

  canView(userId: string, groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;
    if (group.privacy === "public") return true;
    return group.memberIds.has(userId);
  }

  canDiscover(userId: string, groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;
    if (group.privacy === "secret") return group.memberIds.has(userId);
    return true;
  }
}

export class SolaraRealtimeNotifier {
  private listeners = new Set<(event: { type: string; payload: unknown }) => void>();

  subscribe(listener: (event: { type: string; payload: unknown }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type: string, payload: unknown): void {
    for (const l of this.listeners) {
      try {
        l({ type, payload });
      } catch {
        // Safe dispatch
      }
    }
  }

  formatSseMessage(type: string, payload: unknown): string {
    return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  }
}


export class SolaraAnalyticsTracker {
  private events: Array<{ type: string; actorId: string; targetId: string; timestamp: string }> = [];

  track(type: "post_viewed" | "post_liked" | "comment_added" | "follow", actorId: string, targetId: string): void {
    this.events.push({
      type,
      actorId,
      targetId,
      timestamp: new Date().toISOString(),
    });
  }

  getMetricsForTarget(targetId: string): { views: number; likes: number; comments: number } {
    return {
      views: this.events.filter((e) => e.targetId === targetId && e.type === "post_viewed").length,
      likes: this.events.filter((e) => e.targetId === targetId && e.type === "post_liked").length,
      comments: this.events.filter((e) => e.targetId === targetId && e.type === "comment_added").length,
    };
  }
}
