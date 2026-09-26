import * as crypto from "node:crypto";
export interface ModerationDecision {
  status: "approved" | "rejected" | "flagged_for_human_review";
  sanitizedContent?: string;
  flagReason?: string;
  violations?: string[];
  confidenceScore?: number;
}

export interface ModerationStage {
  name: string;
  evaluate(content: string, authorId?: string): Promise<ModerationDecision>;
}

/**
 * 1. Profanity Filter Stage
 */
export class ProfanityFilterStage implements ModerationStage {
  name = "profanity-filter";
  private blockedPatterns: RegExp[] = [
    /\b(spam|scam|phishing|malware|viagra|free-crypto-giveaway)\b/i,
  ];

  async evaluate(content: string): Promise<ModerationDecision> {
    const foundViolations: string[] = [];
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(content)) {
        foundViolations.push(pattern.source);
      }
    }
    if (foundViolations.length > 0) {
      return {
        status: "rejected",
        violations: foundViolations,
        flagReason: "Contenu bloqué par le filtre anti-spam/termes interdits.",
      };
    }
    return { status: "approved" };
  }
}

/**
 * 2. Automated Safety & AI Pre-screening Stage
 */
export class AutomatedSafetyStage implements ModerationStage {
  name = "ai-moderation";

  async evaluate(content: string): Promise<ModerationDecision> {
    // Check for extreme length or suspicious flood characters
    if (content.length > 5000) {
      return {
        status: "flagged_for_human_review",
        flagReason: "Longueur de publication anormale, vérification humaine requise.",
        confidenceScore: 0.85,
      };
    }
    return { status: "approved" };
  }
}

/**
 * 3. Human Review Queue Stage
 */
export interface ReviewQueueItem {
  id: string;
  content: string;
  authorId?: string;
  reason: string;
  createdAt: Date;
  status: "pending" | "approved" | "rejected";
}

export class HumanReviewQueueStage implements ModerationStage {
  name = "human-review-queue";
  private queue = new Map<string, ReviewQueueItem>();

  async evaluate(_content: string, _authorId?: string): Promise<ModerationDecision> {
    // If flagged by earlier stages or contains flagged keywords
    return { status: "approved" };
  }


  enqueue(content: string, authorId: string | undefined, reason: string): ReviewQueueItem {
    const id = `rev-${crypto.randomUUID()}`;
    const item: ReviewQueueItem = {
      id,
      content,
      authorId,
      reason,
      createdAt: new Date(),
      status: "pending",
    };
    this.queue.set(id, item);
    return item;
  }

  getPendingItems(): ReviewQueueItem[] {
    return Array.from(this.queue.values()).filter((i) => i.status === "pending");
  }

  resolveItem(id: string, decision: "approved" | "rejected"): boolean {
    const item = this.queue.get(id);
    if (!item) return false;
    item.status = decision;
    return true;
  }
}

/**
 * Composite Moderation Pipeline
 */
export class SolaraModerationPipeline {
  private stages: ModerationStage[] = [
    new ProfanityFilterStage(),
    new AutomatedSafetyStage(),
  ];

  public humanQueue = new HumanReviewQueueStage();

  addStage(stage: ModerationStage): void {
    this.stages.push(stage);
  }

  async process(content: string, authorId?: string): Promise<ModerationDecision> {
    for (const stage of this.stages) {
      const decision = await stage.evaluate(content, authorId);
      if (decision.status === "rejected") {
        return decision;
      }
      if (decision.status === "flagged_for_human_review") {
        this.humanQueue.enqueue(content, authorId, decision.flagReason || "Signalé par modération automatique");
        return decision;
      }
    }
    return { status: "approved", sanitizedContent: content };
  }
}

/**
 * Mentions & Hashtags Extractor
 */
export interface ExtractedSocialEntities {
  mentions: string[]; // ['@alice', '@bob'] -> ['alice', 'bob']
  hashtags: string[]; // ['#innovation', '#solidarity'] -> ['innovation', 'solidarity']
  cleanedText: string;
}

export class MentionsAndTagsExtractor {
  static extract(content: string): ExtractedSocialEntities {
    const mentionRegex = /@([a-zA-Z0-9_-]{3,30})/g;
    const hashtagRegex = /#([a-zA-Z0-9_\u00C0-\u017F]{2,50})/g;

    const mentions: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(content)) !== null) {
      if (!mentions.includes(match[1])) {
        mentions.push(match[1]);
      }
    }

    const hashtags: string[] = [];
    while ((match = hashtagRegex.exec(content)) !== null) {
      const tag = match[1].toLowerCase();
      if (!hashtags.includes(tag)) {
        hashtags.push(tag);
      }
    }

    return {
      mentions,
      hashtags,
      cleanedText: content,
    };
  }
}
