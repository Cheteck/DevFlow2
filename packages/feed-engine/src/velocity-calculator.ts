import type { FeedPost } from "./index.js";

/**
 * Seedable PRNG (Mulberry32) for deterministic serendipity in tests without Math.random.
 */
export class Mulberry32RNG {
  private state: number;

  constructor(seed: number = 1337) {
    this.state = seed;
  }

  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 85), t | 73);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Trending & Viral Velocity Algorithm (Inspired by HackerNews / Reddit / Phoenix)
 * Velocity = (Engagements) / (Age + 2)^gravity
 */
export class TrendingVelocityRanker {
  public static calculateVelocity(post: FeedPost, gravity = 1.6): number {
    const ageInHours = Math.max(
      0,
      (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60),
    );
    const rawEngagements =
      (post.likeCount || 0) * 2 + (post.commentsCount || 0) * 4;
    return rawEngagements / Math.pow(ageInHours + 2, gravity);
  }

  public static rankByTrending(posts: FeedPost[], gravity = 1.6): FeedPost[] {
    return [...posts].sort(
      (a, b) =>
        this.calculateVelocity(b, gravity) - this.calculateVelocity(a, gravity),
    );
  }
}

/**
 * Périmètre N1 — MMR (Maximal Marginal Relevance) + Diversity Reranker with Hard Constraints.
 */
export interface DiversityRerankerOptions {
  lambda?: number; // MMR trade-off: 1.0 = pure relevance, 0.0 = pure diversity. Default 0.7.
  maxPerAuthor?: number; // Hard constraint: max posts per author (default 2).
  maxPerCategory?: number; // Hard constraint: max posts per tag/category (default 4).
  minCategories?: number; // Hard constraint: minimum distinct categories to surface if pool allows (default 3).
  mutedActorIds?: string[];
  hiddenPostIds?: string[];
  seenPostIds?: string[];
  relevanceScores?: Map<string, number>; // P2: Preserve ForYou scores (finalScore) instead of overwriting with velocity.
  rng?: Mulberry32RNG; // Seedable RNG for serendipity (+0.2 exploration).
}

export class DiversityReranker {
  /**
   * Computes Jaccard/Tag Cosine similarity between two posts based on tags and author similarity.
   */
  public static computeSimilarity(p1: FeedPost, p2: FeedPost): number {
    let similarity = 0;

    // A. Tag similarity (Jaccard)
    const tags1 = new Set((p1.tags || []).map((t) => t.toLowerCase()));
    const tags2 = new Set((p2.tags || []).map((t) => t.toLowerCase()));

    if (tags1.size > 0 && tags2.size > 0) {
      let intersection = 0;
      for (const t of tags1) {
        if (tags2.has(t)) intersection++;
      }
      const union = new Set([...tags1, ...tags2]).size;
      similarity += intersection / union;
    }

    // B. Same author penalty / similarity
    if (p1.actorId === p2.actorId) {
      similarity += 0.5;
    }

    // C. Same target space/group similarity
    if (p1.targetId === p2.targetId && p1.targetType === p2.targetType) {
      similarity += 0.2;
    }

    return Math.min(1.0, similarity);
  }

  /**
   * Reranks candidate posts using greedy Maximal Marginal Relevance (MMR) with hard constraint enforcement.
   */
  public static rerank(
    candidates: FeedPost[],
    options: DiversityRerankerOptions = {},
  ): FeedPost[] {
    const lambda = options.lambda ?? 0.7;
    const maxPerAuthor = options.maxPerAuthor ?? 2;
    const maxPerCategory = options.maxPerCategory ?? 4;
    const minCategories = options.minCategories ?? 3;
    // P2: Production entropy seed if no explicit RNG passed
    const rng =
      options.rng ||
      new Mulberry32RNG(Date.now() ^ Math.floor(Math.random() * 100000));

    const mutedActors = new Set(options.mutedActorIds || []);
    const hiddenPosts = new Set(options.hiddenPostIds || []);
    const seenPosts = new Set(options.seenPostIds || []);

    // 1. Filter out muted, hidden, and already-seen posts
    const pool = candidates.filter(
      (p) =>
        !mutedActors.has(p.actorId) &&
        !hiddenPosts.has(p.id) &&
        !seenPosts.has(p.id) &&
        !p.isDeleted &&
        !p.isHidden,
    );

    if (pool.length === 0) return [];

    // Compute base relevance scores — P2: Preserve ForYou score if supplied
    const relevanceMap = new Map<string, number>();
    for (let i = 0; i < pool.length; i++) {
      const post = pool[i];
      let baseRel = options.relevanceScores?.get(post.id);
      if (baseRel === undefined) {
        // Fall back to candidate order rank or velocity score
        baseRel = TrendingVelocityRanker.calculateVelocity(post);
      }
      // 10% exploration serendipity bonus (+0.2)
      const serendipityBonus = rng.nextFloat() < 0.1 ? 0.2 : 0;
      relevanceMap.set(post.id, baseRel + serendipityBonus);
    }

    const selected: FeedPost[] = [];
    const authorCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const surfacedCategories = new Set<string>();

    const remaining = [...pool];

    while (remaining.length > 0) {
      let bestPostIdx = -1;
      let bestMMRScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const p = remaining[i];
        const authorCount = authorCounts.get(p.actorId) || 0;

        // Hard constraint A: max per author
        if (authorCount >= maxPerAuthor) continue;

        // Hard constraint B: max per category
        const tags = p.tags && p.tags.length > 0 ? p.tags : ["uncategorized"];
        const maxCategoryCount = Math.max(
          ...tags.map((t) => categoryCounts.get(t.toLowerCase()) || 0),
        );
        if (maxCategoryCount >= maxPerCategory) continue;

        const relevance = relevanceMap.get(p.id) || 0;

        // Max similarity to already selected posts
        let maxSim = 0;
        for (const s of selected) {
          const sim = DiversityReranker.computeSimilarity(p, s);
          if (sim > maxSim) maxSim = sim;
        }

        // MMR = λ * Relevance - (1 - λ) * MaxSimilarity
        let mmrScore = lambda * relevance - (1 - lambda) * maxSim;

        // Boost posts with novel categories if minCategories constraint is not yet satisfied
        if (surfacedCategories.size < minCategories) {
          const isNewCategory = tags.some(
            (t) => !surfacedCategories.has(t.toLowerCase()),
          );
          if (isNewCategory) {
            mmrScore += 0.3;
          }
        }

        if (mmrScore > bestMMRScore) {
          bestMMRScore = mmrScore;
          bestPostIdx = i;
        }
      }

      if (bestPostIdx === -1) {
        break;
      }

      const [chosen] = remaining.splice(bestPostIdx, 1);
      selected.push(chosen);

      authorCounts.set(chosen.actorId, (authorCounts.get(chosen.actorId) || 0) + 1);
      const chosenTags =
        chosen.tags && chosen.tags.length > 0 ? chosen.tags : ["uncategorized"];
      for (const t of chosenTags) {
        const catKey = t.toLowerCase();
        categoryCounts.set(catKey, (categoryCounts.get(catKey) || 0) + 1);
        surfacedCategories.add(catKey);
      }
    }

    return selected;
  }
}

/**
 * Périmètre N1 — Feed Telemetry Metrics Collector.
 * Maintains real dynamic interaction counters and calculates rates & Shannon category entropy.
 */
export class FeedMetricsCollector {
  private static realImpressions = 0;
  private static realInteractions = 0;
  private static realSkipsMutes = 0;

  public static recordImpression(count = 1): void {
    this.realImpressions += count;
  }

  public static recordInteraction(count = 1): void {
    this.realInteractions += count;
  }

  public static recordSkipMute(count = 1): void {
    this.realSkipsMutes += count;
  }

  public static getMetricsSummary(): {
    interactionRate: number;
    skipMuteRate: number;
    totalImpressions: number;
  } {
    return {
      interactionRate: this.calculateInteractionRate(this.realInteractions, 0, this.realImpressions),
      skipMuteRate: this.calculateSkipMuteRate(this.realSkipsMutes, 0, this.realImpressions),
      totalImpressions: this.realImpressions,
    };
  }

  public static calculateInteractionRate(
    likes: number,
    comments: number,
    impressions: number,
  ): number {
    if (impressions <= 0) return 0;
    return parseFloat(((likes + comments) / impressions).toFixed(4));
  }

  public static calculateSkipMuteRate(
    skips: number,
    mutes: number,
    impressions: number,
  ): number {
    if (impressions <= 0) return 0;
    return parseFloat(((skips + mutes) / impressions).toFixed(4));
  }

  /**
   * Calculates Shannon Entropy H(X) = -sum(p * log2(p)) over category distribution in a feed batch.
   */
  public static calculateCategoryEntropy(posts: FeedPost[]): number {
    if (posts.length === 0) return 0;

    const categoryFreq = new Map<string, number>();
    let totalTags = 0;

    for (const post of posts) {
      const tags = post.tags && post.tags.length > 0 ? post.tags : ["uncategorized"];
      for (const tag of tags) {
        const key = tag.toLowerCase();
        categoryFreq.set(key, (categoryFreq.get(key) || 0) + 1);
        totalTags++;
      }
    }

    if (totalTags === 0) return 0;

    let entropy = 0;
    for (const count of categoryFreq.values()) {
      const p = count / totalTags;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return parseFloat(entropy.toFixed(4));
  }
}

/**
 * Content Safety & Quality Moderation Engine
 * Evaluates spam, abusive patterns, repetition, and assigns a quality score.
 */
export interface QualityReport {
  score: number; // 0.0 to 1.0 (1.0 is pristine quality)
  isSafe: boolean;
  flags: string[];
}

export class ContentSafetyFilter {
  private static SPAM_KEYWORDS = [
    "viagra",
    "crypto giveaway",
    "free money",
    "gagnez 10000€",
    "double your coins",
    "whatsapp me",
    "click here fast",
    "earn from home fast",
  ];

  public static evaluate(post: FeedPost): QualityReport {
    const flags: string[] = [];
    let penalty = 0;
    const content = (post.content || "").toLowerCase();

    // 1. Spam keyword analysis
    for (const kw of this.SPAM_KEYWORDS) {
      if (content.includes(kw)) {
        flags.push(`spam_keyword:${kw}`);
        penalty += 0.4;
      }
    }

    // 2. Character repetition check (e.g. "aaaaaaa!!!!")
    if (/(.)\1{5,}/.test(content)) {
      flags.push("excessive_character_repetition");
      penalty += 0.2;
    }

    // 3. Excessive uppercase check
    const uppercaseCount = (post.content.match(/[A-Z]/g) || []).length;
    if (
      post.content.length > 20 &&
      uppercaseCount / post.content.length > 0.6
    ) {
      flags.push("excessive_caps");
      penalty += 0.15;
    }

    // 4. Short / Low Effort content
    if (
      post.content.trim().length < 5 &&
      (!post.mediaUrls || post.mediaUrls.length === 0)
    ) {
      flags.push("low_effort");
      penalty += 0.1;
    }

    const score = Math.max(0, Math.min(1, 1.0 - penalty));
    const isSafe =
      score >= 0.5 && !flags.some((f) => f.startsWith("spam_keyword"));

    return { score, isSafe, flags };
  }

  public static filterUnsafe(posts: FeedPost[]): FeedPost[] {
    return posts.filter((post) => this.evaluate(post).isSafe);
  }
}

/**
 * Sponsored Ads Telemetry & Impression Tracker
 * High-precision attribution for impressions, clicks, and CTR calculation.
 */
export interface AdTelemetryEvent {
  campaignId: string;
  postId: string;
  viewerActorId: string;
  eventType: "impression" | "click" | "cta_conversion";
  timestamp: Date;
}

export class SponsorshipTelemetry {
  private static events: AdTelemetryEvent[] = [];

  public static track(event: AdTelemetryEvent): void {
    this.events.push(event);
  }

  public static getMetrics(campaignId: string): {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
  } {
    const campaignEvents = this.events.filter(
      (e) => e.campaignId === campaignId,
    );
    const impressions = campaignEvents.filter(
      (e) => e.eventType === "impression",
    ).length;
    const clicks = campaignEvents.filter((e) => e.eventType === "click").length;
    const conversions = campaignEvents.filter(
      (e) => e.eventType === "cta_conversion",
    ).length;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return {
      impressions,
      clicks,
      conversions,
      ctr: parseFloat(ctr.toFixed(2)),
    };
  }
}

/**
 * AT Protocol-inspired Custom Feed Generators
 */
export type CustomFeedAlgorithm = (
  posts: FeedPost[],
  context: Record<string, unknown>,
) => FeedPost[];

export class FeedGeneratorRegistry {
  private static generators = new Map<string, CustomFeedAlgorithm>();

  public static register(name: string, algorithm: CustomFeedAlgorithm): void {
    this.generators.set(name, algorithm);
  }

  public static resolve(name: string): CustomFeedAlgorithm | undefined {
    return this.generators.get(name);
  }

  public static listAvailable(): string[] {
    return Array.from(this.generators.keys());
  }
}

// Pre-register standard platform algorithms
FeedGeneratorRegistry.register("trending", (posts) =>
  TrendingVelocityRanker.rankByTrending(posts),
);
FeedGeneratorRegistry.register("media_only", (posts) =>
  posts.filter((p) => p.mediaUrls && p.mediaUrls.length > 0),
);
