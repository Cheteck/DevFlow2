import type { AuthChallenge } from "@mosaix/contracts";

export interface Challenge {
  id: string;
  type: AuthChallenge["type"];
  data: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
}

export interface ChallengeManagerOptions {
  defaultTtlSeconds?: number;
  maxAttempts?: number;
}

export class ChallengeManager {
  private readonly challenges = new Map<string, Challenge>();
  private readonly defaultTtlSeconds: number;
  private readonly maxAttempts: number;

  constructor(options: ChallengeManagerOptions = {}) {
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 300;
    this.maxAttempts = options.maxAttempts ?? 3;
  }

  create(
    type: AuthChallenge["type"],
    data: Record<string, unknown> = {},
    ttlSeconds?: number,
  ): Challenge {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (ttlSeconds ?? this.defaultTtlSeconds) * 1000,
    ).toISOString();

    const challenge: Challenge = {
      id: crypto.randomUUID(),
      type,
      data,
      createdAt: now.toISOString(),
      expiresAt,
      attempts: 0,
      maxAttempts: this.maxAttempts,
    };

    this.challenges.set(challenge.id, challenge);
    this.cleanupExpired();
    return challenge;
  }

  get(id: string): Challenge | undefined {
    const challenge = this.challenges.get(id);
    if (!challenge) return undefined;

    if (this.isExpired(challenge)) {
      this.challenges.delete(id);
      return undefined;
    }

    return challenge;
  }

  incrementAttempt(id: string): Challenge | undefined {
    const challenge = this.get(id);
    if (!challenge) return undefined;

    challenge.attempts += 1;
    return challenge;
  }

  consume(id: string): Challenge | undefined {
    const challenge = this.get(id);
    if (!challenge) return undefined;

    if (challenge.attempts >= challenge.maxAttempts) {
      this.challenges.delete(id);
      return undefined;
    }

    this.challenges.delete(id);
    return challenge;
  }

  revoke(id: string): void {
    this.challenges.delete(id);
  }

  private isExpired(challenge: Challenge): boolean {
    return new Date(challenge.expiresAt) <= new Date();
  }

  private cleanupExpired(): void {
    const now = new Date();
    for (const [id, challenge] of this.challenges.entries()) {
      if (new Date(challenge.expiresAt) <= now) {
        this.challenges.delete(id);
      }
    }
  }

  clear(): void {
    this.challenges.clear();
  }

  list(): Challenge[] {
    const now = new Date();
    const result: Challenge[] = [];
    for (const challenge of this.challenges.values()) {
      if (new Date(challenge.expiresAt) >= now) {
        result.push(challenge);
      }
    }
    return result;
  }
}
