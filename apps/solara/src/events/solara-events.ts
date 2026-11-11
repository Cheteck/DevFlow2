/**
 * @apps/solara/events — Versioned event payload schemas (JSON Schema, no new deps).
 * Registered at boot via `registerEventSchema`, published via `app.publish`.
 */

export interface SolaraPostPublishedPayload {
  postId: string;
  actorId: string;
  publicationType: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export interface SolaraCommentCreatedPayload {
  commentId: string;
  postId: string;
  actorId: string;
  createdAt: string;
}

export interface SolaraReactionAddedPayload {
  reactionId: string;
  targetType: string;
  targetId: string;
  actorId: string;
  type: string;
}

export interface SolaraFollowerAddedPayload {
  followerActorId: string;
  targetActorId: string;
}

export const solaraEventPayloadSchemas = {
  "solara.post.published": {
    type: "object",
    required: ["postId", "actorId", "publicationType", "targetType", "targetId", "createdAt"],
    properties: {
      postId: { type: "string" },
      actorId: { type: "string" },
      publicationType: { type: "string" },
      targetType: { type: "string" },
      targetId: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  "solara.comment.created": {
    type: "object",
    required: ["commentId", "postId", "actorId", "createdAt"],
    properties: {
      commentId: { type: "string" },
      postId: { type: "string" },
      actorId: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  "solara.reaction.added": {
    type: "object",
    required: ["reactionId", "targetType", "targetId", "actorId", "type"],
    properties: {
      reactionId: { type: "string" },
      targetType: { type: "string" },
      targetId: { type: "string" },
      actorId: { type: "string" },
      type: { type: "string" },
    },
  },
  "solara.follower.added": {
    type: "object",
    required: ["followerActorId", "targetActorId"],
    properties: {
      followerActorId: { type: "string" },
      targetActorId: { type: "string" },
    },
  },
} as const;
