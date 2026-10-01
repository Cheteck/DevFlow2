/**
 * @mosaix/feed-engine — Feed Aggregation & Activity Grouping
 */

import type {
  FeedPost,
  FeedAggregationOptions,
  PaginatedFeedOptions,
  PaginatedFeedResult,
  GroupedActivityCard,
  FeedAuthor,
  ActivityType,
} from "./types.js";
import { FeedScorer } from "./scoring.js";

export class FeedAggregator {
  public static aggregate(
    allPosts: FeedPost[],
    followedSpaceIdsOrOptions: string[] | FeedAggregationOptions,
    legacyFollowedSpaceIds?: string[],
  ): FeedPost[] {
    let options: FeedAggregationOptions;

    if (Array.isArray(followedSpaceIdsOrOptions)) {
      options = {
        followedSpaceIds: followedSpaceIdsOrOptions,
      };
    } else {
      options = followedSpaceIdsOrOptions || {};
    }

    if (legacyFollowedSpaceIds && !options.followedSpaceIds) {
      options.followedSpaceIds = legacyFollowedSpaceIds;
    }

    const spaceIds = new Set(options.followedSpaceIds || []);
    const groupIds = new Set(options.followedGroupIds || []);
    const eventIds = new Set(options.followedEventIds || []);
    const blockedActors = new Set(options.blockedActorIds || []);
    const mutedTags = new Set(
      (options.mutedTags || []).map((t) => t.toLowerCase()),
    );
    const allowedVisibilities = options.allowedVisibilities
      ? new Set(options.allowedVisibilities)
      : null;

    const filtered = allPosts.filter((post) => {
      if (post.isDeleted || post.isHidden) return false;
      if (blockedActors.has(post.actorId)) return false;

      if (
        post.visibility &&
        allowedVisibilities &&
        !allowedVisibilities.has(post.visibility)
      ) {
        return false;
      }

      if (post.tags && post.tags.some((t) => mutedTags.has(t.toLowerCase()))) {
        return false;
      }

      switch (post.targetType) {
        case "feed":
          return true;
        case "space":
          return spaceIds.has(post.targetId);
        case "group":
          return groupIds.has(post.targetId);
        case "event":
          return eventIds.has(post.targetId);
        default:
          return false;
      }
    });

    const sortBy = options.sortBy || "reverse_chronological";
    const referenceDate = options.now || new Date();

    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      switch (sortBy) {
        case "chronological":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "engagement": {
          const scoreA =
            a.likeCount + a.commentsCount * 2 + (a.repostCount || 0) * 3;
          const scoreB =
            b.likeCount + b.commentsCount * 2 + (b.repostCount || 0) * 3;
          return scoreB - scoreA;
        }
        case "score": {
          const scoreA = FeedScorer.calculateScore(a, referenceDate);
          const scoreB = FeedScorer.calculateScore(b, referenceDate);
          return scoreB - scoreA;
        }
        case "reverse_chronological":
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  }

  public static aggregatePaginated(
    allPosts: FeedPost[],
    followedSpaceIds: string[],
    options: PaginatedFeedOptions = {},
  ): PaginatedFeedResult {
    const sorted = this.aggregate(allPosts, followedSpaceIds);
    const limit = options.limit && options.limit > 0 ? options.limit : 20;

    let filtered = sorted;
    if (options.afterCursor) {
      const cursorTime = new Date(options.afterCursor).getTime();
      if (!isNaN(cursorTime)) {
        filtered = filtered.filter((p) => p.createdAt.getTime() < cursorTime);
      }
    }

    const items = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const lastItem = items[items.length - 1];
    const nextCursor = lastItem ? lastItem.createdAt.toISOString() : undefined;

    return {
      items,
      hasMore,
      nextCursor,
    };
  }
}

export class ActivityGrouper {
  public static groupActivities(
    posts: FeedPost[],
  ): Array<FeedPost | GroupedActivityCard> {
    const groupedMap = new Map<string, FeedPost[]>();
    const standalone: FeedPost[] = [];

    for (const post of posts) {
      if (
        (post.activityType === "like" || post.activityType === "announce") &&
        post.parentId
      ) {
        const key = `${post.activityType}:${post.parentId}`;
        const existing = groupedMap.get(key) || [];
        existing.push(post);
        groupedMap.set(key, existing);
      } else {
        standalone.push(post);
      }
    }

    const result: Array<FeedPost | GroupedActivityCard> = [...standalone];

    for (const [key, group] of groupedMap.entries()) {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        const [actType, targetPostId] = key.split(":");
        const actors: FeedAuthor[] = group
          .map((g) => g.author || { id: g.actorId })
          .filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);

        const latestDate = new Date(
          Math.max(...group.map((g) => g.createdAt.getTime())),
        );

        result.push({
          id: `grouped_${key}_${latestDate.getTime()}`,
          activityType: actType as ActivityType,
          targetPostId,
          actors,
          actorCount: actors.length,
          latestCreatedAt: latestDate,
          posts: group,
        });
      }
    }

    return result;
  }
}
