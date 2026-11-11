/**
 * @mosaix/shell — In-Memory Token Bucket Rate Limiter
 * Protects sensitive endpoints against brute-force and DDoS attacks.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { sendProblemResponse } from "./http-errors.js";

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly capacity: number = 60, // max tokens
    private readonly refillRatePerSecond: number = 10, // tokens per second
    private readonly bucketTtlMs: number = 5 * 60 * 1000, // idle bucket eviction
  ) {}

  /** Start the idle-bucket sweeper. Idempotent; safe to call multiple times. */
  startSweep(intervalMs: number = 60_000): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), intervalMs);
    this.sweepTimer.unref?.();
  }

  /** Stop the sweeper. Safe to call when never started. */
  stopSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > this.bucketTtlMs) {
        this.buckets.delete(key);
      }
    }
  }

  private getClientIp(req: IncomingMessage): string {
    // Anti-spoofing (VULN-06): only trust X-Forwarded-For behind an
    // explicit trusted proxy (TRUST_PROXY=true). Otherwise the socket
    // address is the only reliable key — a spoofed header would let an
    // attacker rotate identities and bypass the bucket.
    const trustProxy =
      process.env.TRUST_PROXY === "true" ||
      process.env.MOSAIX_TRUST_PROXY === "true";
    if (trustProxy) {
      const forwarded = req.headers["x-forwarded-for"];
      if (typeof forwarded === "string") {
        return forwarded.split(",")[0].trim();
      }
    }
    return req.socket.remoteAddress || "127.0.0.1";
  }

  checkLimit(
    req: IncomingMessage,
    routeKey: string = "default",
  ): { allowed: boolean; remaining: number } {
    const ip = this.getClientIp(req);
    const key = `${ip}:${routeKey}`;
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSeconds = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(
        this.capacity,
        bucket.tokens + elapsedSeconds * this.refillRatePerSecond,
      );
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    return { allowed: false, remaining: 0 };
  }

  middleware(
    routeKey: string = "default",
  ): (req: IncomingMessage, res: ServerResponse) => boolean {
    return (req: IncomingMessage, res: ServerResponse): boolean => {
      const { allowed, remaining } = this.checkLimit(req, routeKey);
      res.setHeader("X-RateLimit-Limit", this.capacity.toString());
      res.setHeader("X-RateLimit-Remaining", remaining.toString());

      if (!allowed) {
        res.setHeader("Retry-After", "2");
        sendProblemResponse(
          res,
          429,
          "Too Many Requests",
          "Vous avez dépassé la limite de requêtes autorisées. Veuillez patienter avant de réessayer.",
        );
        return false;
      }
      return true;
    };
  }
}

export const standardRateLimiter = new RateLimiter(100, 20);
export const strictRateLimiter = new RateLimiter(15, 2);

// Idle-bucket sweeper: prevents unbounded Map growth under distributed
// attack patterns (VULN-06 follow-up). Unref'd so it never blocks shutdown.
standardRateLimiter.startSweep();
strictRateLimiter.startSweep();
