/**
 * @mosaix/feed-engine — ActivityStreams 2.0 Serialization & Mapping
 */

import type {
  FeedPost,
  ActivityStreamObject,
  ActivityStreamsNote,
  SocialActorType,
} from "./types.js";

export class ActivityStreamsMapper {
  public static toActivityStream(post: FeedPost): ActivityStreamObject {
    const actorTypeMap: Record<SocialActorType, string> = {
      user: "Person",
      space: "Group",
      organization: "Organization",
      system: "Application",
    };

    const mappedActorType = actorTypeMap[post.actorType] || "Person";

    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `urn:mosaix:activity:${post.id}`,
      type: post.activityType || "Create",
      actor: {
        id: post.author?.id || post.actorId,
        type: mappedActorType,
        name: post.author?.name,
        preferredUsername: post.author?.handle,
        icon: post.author?.avatarUrl
          ? { type: "Image", url: post.author.avatarUrl }
          : undefined,
      },
      object: {
        id: `urn:mosaix:post:${post.id}`,
        type: "Note",
        attributedTo: post.actorId,
        content: post.content,
        name: post.title,
        summary: post.summary,
        published: post.createdAt.toISOString(),
        updated: post.updatedAt?.toISOString(),
        tag: post.tags?.map((t) => ({ type: "Hashtag", name: t })),
        attachment: post.attachments?.map((a) => ({
          type: "Document",
          mediaType: a.mimeType,
          url: a.url,
          name: a.title,
        })),
        to:
          post.visibility === "public"
            ? ["https://www.w3.org/ns/activitystreams#Public"]
            : undefined,
      },
      published: post.createdAt.toISOString(),
    };
  }

  public static fromActivityStream(
    activity: ActivityStreamObject,
  ): Partial<FeedPost> {
    const obj = activity.object || {};
    const actor = activity.actor || {};

    const reverseActorMap: Record<string, SocialActorType> = {
      Person: "user",
      Group: "space",
      Organization: "organization",
      Application: "system",
    };

    return {
      id: obj.id
        ? obj.id.replace(/^urn:mosaix:post:/, "")
        : activity.id
          ? activity.id.replace(/^urn:mosaix:activity:/, "")
          : "unknown",
      actorType: reverseActorMap[actor.type] || "user",
      actorId: actor.id || "unknown",
      author: {
        id: actor.id || "unknown",
        name: actor.name,
        handle: actor.preferredUsername,
        avatarUrl: actor.icon?.url,
      },
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      title: obj.name,
      summary: obj.summary,
      content: obj.content || "",
      tags: obj.tag?.map((t) => t.name),
      attachments: obj.attachment?.map((a) => ({
        type: a.type || "link",
        url: a.url,
        mimeType: a.mediaType || ((a as Record<string, unknown>).mimeType as string | undefined),
        title: a.name,
      })),
      likeCount: 0,
      commentsCount: 0,
      createdAt: new Date(obj.published || activity.published || Date.now()),
    };
  }
}

export class ActivityStreamsConverter {
  public static toActivityPubJSON(
    post: FeedPost,
    instanceDomain = "mosaix.local",
  ): ActivityStreamsNote {
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `https://${instanceDomain}/posts/${post.id}`,
      type: "Note",
      attributedTo: `https://${instanceDomain}/actors/${post.actorType}/${post.actorId}`,
      content: post.content,
      published: post.createdAt.toISOString(),
      attachment: post.mediaUrls?.map((url) => ({
        type: "Image",
        href: url,
      })),
      likeCount: post.likeCount,
    };
  }

  public static fromActivityPubJSON(note: ActivityStreamsNote): FeedPost {
    const matchActor = note.attributedTo.match(/actors\/([^/]+)\/([^/]+)$/);
    const actorType = (matchActor ? matchActor[1] : "user") as SocialActorType;
    const actorId = matchActor ? matchActor[2] : note.attributedTo;

    return {
      id: note.id.split("/").pop() || note.id,
      actorType,
      actorId,
      publicationType: "text",
      targetType: "feed",
      targetId: "global",
      content: note.content,
      mediaUrls: note.attachment?.map((att) => att.href),
      likeCount: note.likeCount || 0,
      commentsCount: 0,
      createdAt: new Date(note.published),
    };
  }
}
