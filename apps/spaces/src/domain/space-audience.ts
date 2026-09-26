import * as crypto from "node:crypto";
/**
 * @apps/spaces — Public Followers & Community Membership Workflow (GAP-03)
 */

export interface SpaceFollower {
  spaceId: string;
  userId: string;
  followedAt: string;
}

export type CommunityMembershipStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CommunityMembershipRequest {
  id: string;
  spaceId: string;
  userId: string;
  status: CommunityMembershipStatus;
  requestedAt: string;
  reviewedAt?: string;
}

export class SpaceAudienceEngine {
  private followers: SpaceFollower[] = [];
  private membershipRequests: CommunityMembershipRequest[] = [];

  followSpace(spaceId: string, userId: string): SpaceFollower {
    const existing = this.followers.find((f) => f.spaceId === spaceId && f.userId === userId);
    if (existing) return existing;

    const follower: SpaceFollower = {
      spaceId,
      userId,
      followedAt: new Date().toISOString(),
    };
    this.followers.push(follower);
    return follower;
  }

  getFollowersCount(spaceId: string): number {
    return this.followers.filter((f) => f.spaceId === spaceId).length;
  }

  requestCommunityMembership(spaceId: string, userId: string): CommunityMembershipRequest {
    const req: CommunityMembershipRequest = {
      id: `req-${crypto.randomUUID()}`,
      spaceId,
      userId,
      status: "PENDING",
      requestedAt: new Date().toISOString(),
    };
    this.membershipRequests.push(req);
    return req;
  }

  reviewMembershipRequest(requestId: string, approve: boolean): CommunityMembershipRequest {
    const req = this.membershipRequests.find((r) => r.id === requestId);
    if (!req) throw new Error(`Membership request [${requestId}] not found.`);

    req.status = approve ? "APPROVED" : "REJECTED";
    req.reviewedAt = new Date().toISOString();
    return req;
  }

  listPendingMembershipRequests(spaceId: string): CommunityMembershipRequest[] {
    return this.membershipRequests.filter((r) => r.spaceId === spaceId && r.status === "PENDING");
  }
}
