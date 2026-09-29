// NOTE (FEED-V0, 2026-09-29) : `FeedScoringEngine`/`FeedSortStrategy` (doublon
// mort de `FeedRanker`/`TrendingVelocityRanker`, 0 appelant) et
// `SolaraAnalyticsTracker` (0 appelant, remplacé par `FeedMetricsCollector` +
// futur event logging FEED-V2) ont été retirés. Ne pas réintroduire de scoreur
// parallèle : étendre `FeedRanker` dans `@mosaix/feed-engine`.

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

/**
 * @deprecated FEED-V0 (2026-09-29) — 0 appelant : utiliser
 * `FeedMetricsCollector` (`@mosaix/feed-engine`) et le futur event logging
 * FEED-V2. Conservé vide pour ne pas casser d'import externe ; sera supprimé.
 */
export class SolaraAnalyticsTracker {
  track(
    _type: "post_viewed" | "post_liked" | "comment_added" | "follow",
    _actorId: string,
    _targetId: string,
  ): void {
    // No-op by design (see deprecation note above).
  }

  getMetricsForTarget(_targetId: string): { views: number; likes: number; comments: number } {
    return { views: 0, likes: 0, comments: 0 };
  }
}
