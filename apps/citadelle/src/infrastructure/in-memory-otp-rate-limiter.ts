/**
 * @apps/citadelle — In-Memory OtpRateLimiterPort
 *
 * Temporary in-memory implementation. Production should use
 * @mosaix/adapter-otp-rate-limiter with a real cache (Redis).
 */

import type { OtpRateLimiterPort } from "@mosaix/otp";

interface RateLimitEntry {
  count: number;
  windowStart: number;
  lastResend: number;
}

export class InMemoryOtpRateLimiter implements OtpRateLimiterPort {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequestsPerHour: number;
  private readonly resendCooldownSeconds: number;

  constructor(maxRequestsPerHour: number = 5, resendCooldownSeconds: number = 60) {
    this.maxRequestsPerHour = maxRequestsPerHour;
    this.resendCooldownSeconds = resendCooldownSeconds * 1000;
  }

  async canRequest(scope: string): Promise<boolean> {
    const entry = this.store.get(scope);
    const now = Date.now();
    if (!entry || now - entry.windowStart > 3600 * 1000) {
      return true;
    }
    return entry.count < this.maxRequestsPerHour;
  }

  async recordRequest(scope: string): Promise<void> {
    const now = Date.now();
    const entry = this.store.get(scope);
    if (!entry || now - entry.windowStart > 3600 * 1000) {
      this.store.set(scope, { count: 1, windowStart: now, lastResend: 0 });
    } else {
      entry.count++;
      this.store.set(scope, entry);
    }
  }

  async reserveSlot(scope: string): Promise<boolean> {
    const can = await this.canRequest(scope);
    if (can) {
      await this.recordRequest(scope);
    }
    return can;
  }

  async releaseSlot(scope: string): Promise<void> {
    const entry = this.store.get(scope);
    if (entry && entry.count > 0) {
      entry.count--;
      this.store.set(scope, entry);
    }
  }

  async canResend(scope: string): Promise<boolean> {
    const entry = this.store.get(scope);
    if (!entry) return true;
    const now = Date.now();
    return now - entry.lastResend > this.resendCooldownSeconds;
  }

  async recordResend(scope: string): Promise<void> {
    const entry = this.store.get(scope);
    if (entry) {
      entry.lastResend = Date.now();
      this.store.set(scope, entry);
    }
  }
}
