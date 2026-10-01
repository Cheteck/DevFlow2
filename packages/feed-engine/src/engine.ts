/**
 * @mosaix/feed-engine — Core Feed Engine & Type Guards
 */

import type {
  FeedPost,
  FeedCardContext,
  StructuredFeedCard,
  FeedComponentRenderer,
  FeedStructuredRenderer,
  FeedPostInterceptor,
  Feedable,
  Engageable,
  SponsoredPost,
} from "./types.js";

export function isFeedable(entity: unknown): entity is Feedable {
  return (
    typeof entity === "object" &&
    entity !== null &&
    (entity as Feedable).isFeedable === true &&
    typeof (entity as Feedable).toFeedProjection === "function"
  );
}

export function isEngageable(entity: unknown): entity is Engageable {
  return (
    typeof entity === "object" &&
    entity !== null &&
    (entity as Engageable).isEngageable === true &&
    typeof (entity as Engageable).targetId === "string"
  );
}

export function isSponsoredPost(post: unknown): post is SponsoredPost {
  return (
    typeof post === "object" &&
    post !== null &&
    (post as SponsoredPost).isSponsored === true &&
    typeof (post as SponsoredPost).campaignId === "string"
  );
}

export class FeedEngine {
  private renderers = new Map<string, FeedComponentRenderer>();
  private structuredRenderers = new Map<string, FeedStructuredRenderer>();
  private interceptors: FeedPostInterceptor[] = [];

  public registerRenderer(renderer: FeedComponentRenderer): void {
    this.renderers.set(renderer.publicationType, renderer);
  }

  public unregisterRenderer(publicationType: string): boolean {
    return this.renderers.delete(publicationType);
  }

  public registerStructuredRenderer(renderer: FeedStructuredRenderer): void {
    this.structuredRenderers.set(renderer.publicationType, renderer);
  }

  public unregisterStructuredRenderer(publicationType: string): boolean {
    return this.structuredRenderers.delete(publicationType);
  }

  public registerInterceptor(interceptor: FeedPostInterceptor): void {
    this.interceptors.push(interceptor);
    this.interceptors.sort((a, b) => a.priority - b.priority);
  }

  public unregisterInterceptor(nameOrPriority: string | number): boolean {
    const initialLen = this.interceptors.length;
    if (typeof nameOrPriority === "string") {
      this.interceptors = this.interceptors.filter(
        (i) => i.name !== nameOrPriority,
      );
    } else {
      this.interceptors = this.interceptors.filter(
        (i) => i.priority !== nameOrPriority,
      );
    }
    return this.interceptors.length < initialLen;
  }

  public clear(): void {
    this.renderers.clear();
    this.structuredRenderers.clear();
    this.interceptors = [];
  }

  public renderPost(post: FeedPost, context: FeedCardContext): string {
    const renderer = this.renderers.get(post.publicationType);
    if (renderer) {
      try {
        return renderer.render(post, context);
      } catch (err) {
        console.error(
          `[FeedEngine] Renderer failed for type [${post.publicationType}]:`,
          err,
        );
      }
    }
    return this.renderDefault(post);
  }

  public renderStructuredPost(
    post: FeedPost,
    context: FeedCardContext,
  ): StructuredFeedCard {
    const renderer = this.structuredRenderers.get(post.publicationType);
    if (renderer) {
      try {
        return renderer.renderStructured(post, context);
      } catch (err) {
        console.error(
          `[FeedEngine] Structured renderer failed for [${post.publicationType}]:`,
          err,
        );
      }
    }
    return {
      id: post.id,
      publicationType: post.publicationType,
      componentName: "DefaultFeedCard",
      props: { post },
      fallbackHtml: this.renderDefault(post),
    };
  }

  public async processPostsPipeline(posts: FeedPost[]): Promise<FeedPost[]> {
    const activePosts = posts.filter((p) => !p.isDeleted && !p.isHidden);
    let currentPosts = [...activePosts];

    for (const interceptor of this.interceptors) {
      if (interceptor.batchIntercept) {
        try {
          currentPosts = await interceptor.batchIntercept(currentPosts);
        } catch (err) {
          console.error(
            `[FeedEngine] Batch interceptor error [${interceptor.name || "unnamed"}]:`,
            err,
          );
        }
      } else {
        const nextProcessed: FeedPost[] = [];
        for (const post of currentPosts) {
          if (interceptor.canIntercept(post)) {
            try {
              const res = await interceptor.intercept({ ...post });
              if (res) nextProcessed.push(res);
            } catch (err) {
              console.error(
                `[FeedEngine] Interceptor error on post [${post.id}]:`,
                err,
              );
              nextProcessed.push(post);
            }
          } else {
            nextProcessed.push(post);
          }
        }
        currentPosts = nextProcessed;
      }
    }
    return currentPosts.filter((p) => !p.isDeleted && !p.isHidden);
  }

  private renderDefault(post: FeedPost): string {
    const safeContent = String(post.content || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const safeTitle = post.title
      ? `<div class="font-bold mb-1">${String(post.title).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`
      : "";

    return `
      <div class="p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 text-xs text-on-surface leading-relaxed">
        ${safeTitle}${safeContent}
      </div>
    `.trim();
  }
}

export class FeedEngineRegistry {
  private static defaultInstance = new FeedEngine();

  public static getDefaultEngine(): FeedEngine {
    return this.defaultInstance;
  }

  public static registerRenderer(renderer: FeedComponentRenderer): void {
    this.defaultInstance.registerRenderer(renderer);
  }

  public static unregisterRenderer(publicationType: string): boolean {
    return this.defaultInstance.unregisterRenderer(publicationType);
  }

  public static registerStructuredRenderer(
    renderer: FeedStructuredRenderer,
  ): void {
    this.defaultInstance.registerStructuredRenderer(renderer);
  }

  public static registerInterceptor(interceptor: FeedPostInterceptor): void {
    this.defaultInstance.registerInterceptor(interceptor);
  }

  public static unregisterInterceptor(
    nameOrPriority: string | number,
  ): boolean {
    return this.defaultInstance.unregisterInterceptor(nameOrPriority);
  }

  public static clear(): void {
    this.defaultInstance.clear();
  }

  public static renderPost(post: FeedPost, context: FeedCardContext): string {
    return this.defaultInstance.renderPost(post, context);
  }

  public static renderStructuredPost(
    post: FeedPost,
    context: FeedCardContext,
  ): StructuredFeedCard {
    return this.defaultInstance.renderStructuredPost(post, context);
  }

  public static async processPostsPipeline(
    posts: FeedPost[],
  ): Promise<FeedPost[]> {
    return this.defaultInstance.processPostsPipeline(posts);
  }
}
