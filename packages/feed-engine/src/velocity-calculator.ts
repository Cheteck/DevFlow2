import type { FeedPost } from "./index.js";

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
