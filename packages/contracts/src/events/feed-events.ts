import type { MosaixEventEnvelope } from "@mosaix/types";

export interface FeedPostCreatedPayload {
  postId: string;
  actorType: string;
  actorId: string;
  publicationType: string;
  targetType: string;
  targetId: string;
  content: string;
  mediaUrls?: string[];
  createdAt: string;
}

export interface FeedReactionToggledPayload {
  reactionId: string;
  targetType: "post" | "comment" | "custom";
  targetId: string;
  actorType: string;
  actorId: string;
  type: "like" | "love" | "laugh" | "surprised" | "sad" | "angry";
  action: "added" | "removed";
  toggledAt: string;
}

export interface FeedCommentAddedPayload {
  commentId: string;
  targetType: "post";
  targetId: string;
  actorType: string;
  actorId: string;
  content: string;
  createdAt: string;
}

export type FeedPostCreatedEvent = MosaixEventEnvelope<FeedPostCreatedPayload>;
export type FeedReactionToggledEvent = MosaixEventEnvelope<FeedReactionToggledPayload>;
export type FeedCommentAddedEvent = MosaixEventEnvelope<FeedCommentAddedPayload>;
