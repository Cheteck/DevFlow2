/**
 * @mosaix/feed-engine — Relevance Scoring, Ranking & Sponsorship Injection
 */

import type {
  FeedPost,
  SponsoredPost,
  SponsorshipInjectionOptions,
  FeedRankingContext,
  FeedRankingWeights,
  UserRecommendationProfile,
} from "./types.js";
import { DiversityReranker, type DiversityRerankerOptions } from "./velocity-calculator.js";

export class FeedScorer {
  public static calculateScore(
    post: FeedPost,
    referenceDate: Date = new Date(),
    gravity = 1.8,
  ): number {
    const likes = post.likeCount || 0;
    const comments = post.commentsCount || 0;
    const reposts = post.repostCount || 0;

    const rawEngagement = likes * 1 + comments * 2 + reposts * 3 + 1;
    const ageInHours = Math.max(
      0,
      (referenceDate.getTime() - post.createdAt.getTime()) / (1000 * 60 * 60),
    );

    return rawEngagement / Math.pow(ageInHours + 2, gravity);
  }
}

export class FeedRanker {
  public static calculateScore(
    post: FeedPost,
    context: FeedRankingContext = {},
  ): number {
    const weights = {
      recencyWeight: context.weights?.recencyWeight ?? 0.4,
      engagementWeight: context.weights?.engagementWeight ?? 0.3,
      affinityWeight: context.weights?.affinityWeight ?? 0.3,
      timeDecayHalfLifeHours: context.weights?.timeDecayHalfLifeHours ?? 24,
    };

    const ageInHours = Math.max(
      0,
      (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60),
    );
    const recencyScore = Math.pow(
      0.5,
      ageInHours / weights.timeDecayHalfLifeHours,
    );

    const totalEngagements =
      (post.likeCount || 0) * 1 + (post.commentsCount || 0) * 2;
    const engagementScore = Math.min(1, Math.log10(totalEngagements + 1) / 3);

    const isFollowedSpace =
      context.currentUserFollowedSpaces?.includes(post.targetId) ?? false;
    const affinityScore = isFollowedSpace ? 1.0 : 0.2;

    return (
      recencyScore * weights.recencyWeight +
      engagementScore * weights.engagementWeight +
      affinityScore * weights.affinityWeight
    );
  }

  public static rank(
    posts: FeedPost[],
    context: FeedRankingContext = {},
  ): FeedPost[] {
    return [...posts].sort(
      (a, b) =>
        this.calculateScore(b, context) - this.calculateScore(a, context),
    );
  }
}

export class SponsoredPostInjector {
  public static inject(
    organicPosts: FeedPost[],
    sponsoredPool: SponsoredPost[],
    options: SponsorshipInjectionOptions = {},
  ): FeedPost[] {
    if (!sponsoredPool || sponsoredPool.length === 0) return organicPosts;

    const interval =
      options.interval && options.interval > 0 ? options.interval : 5;
    const maxSponsored = options.maxSponsoredPosts ?? 3;

    const result: FeedPost[] = [];
    let sponsoredInserted = 0;
    let organicCounter = 0;

    for (const post of organicPosts) {
      result.push(post);
      organicCounter++;

      if (
        organicCounter % interval === 0 &&
        sponsoredInserted < maxSponsored &&
        sponsoredInserted < sponsoredPool.length
      ) {
        result.push(sponsoredPool[sponsoredInserted]);
        sponsoredInserted++;
      }
    }

    return result;
  }
}

export class ForYouRecommendationEngine {
  public static generateForYouFeed(
    allPosts: FeedPost[],
    profile: UserRecommendationProfile,
    options: { weights?: FeedRankingWeights; rerankerOptions?: DiversityRerankerOptions } = {},
  ): FeedPost[] {
    const mutedSet = new Set(profile.mutedActorIds || []);
    const hiddenSet = new Set(profile.hiddenPostIds || []);

    const eligiblePosts = allPosts.filter((post) => {
      if (mutedSet.has(post.actorId)) return false;
      if (hiddenSet.has(post.id)) return false;
      return true;
    });

    const relevanceScores = new Map<string, number>();

    const scoredPosts = eligiblePosts.map((post) => {
      const baseScore = FeedRanker.calculateScore(post, {
        currentUserFollowedSpaces: profile.followedSpaceIds,
        weights: options.weights,
      });

      let interestBonus = 0;
      if (
        profile.interestTags &&
        profile.interestTags.length > 0 &&
        post.metadata?.tags
      ) {
        const postTags = Array.isArray(post.metadata.tags)
          ? post.metadata.tags
          : [];
        const matchingTags = postTags.filter((tag) =>
          profile.interestTags!.includes(String(tag)),
        );
        interestBonus = matchingTags.length * 0.25;
      }

      const isUnfollowedSpace =
        !profile.followedSpaceIds.includes(post.targetId) &&
        post.targetType === "space";
      const isTrending = post.likeCount + post.commentsCount >= 5;
      const serendipityBonus = isUnfollowedSpace && isTrending ? 0.2 : 0;

      const finalScore = baseScore + interestBonus + serendipityBonus;
      relevanceScores.set(post.id, finalScore);

      return {
        post,
        finalScore,
      };
    });

    scoredPosts.sort((a, b) => b.finalScore - a.finalScore);
    const rankedCandidates = scoredPosts.map((item) => item.post);

    // Pipeline N1 (P2 Remediation): Execute DiversityReranker preserving ForYou relevanceScores (finalScore)
    return DiversityReranker.rerank(rankedCandidates, {
      mutedActorIds: profile.mutedActorIds,
      hiddenPostIds: profile.hiddenPostIds,
      relevanceScores,
      ...options.rerankerOptions,
    });
  }
}
