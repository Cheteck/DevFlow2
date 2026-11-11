import { OtpRateLimiterPort } from "@mosaix/otp";
import { CachePort } from "@mosaix/ports-cache";

export class OtpCacheRateLimiterAdapter implements OtpRateLimiterPort {
  constructor(private readonly cache: CachePort, private readonly ttlSeconds: number = 3600) {}

  async reserveSlot(scope: string): Promise<boolean> {
    const key = `otp:rate:${scope}`;
    const count = (await this.cache.get<number>(key)) ?? 0;
    if (count >= 5) return false;
    await this.cache.set(key, count + 1, { ttl: this.ttlSeconds });
    return true;
  }

  async releaseSlot(scope: string): Promise<void> {
    const key = `otp:rate:${scope}`;
    const count = (await this.cache.get<number>(key)) ?? 0;
    if (count > 0) await this.cache.set(key, count - 1, { ttl: this.ttlSeconds });
  }

  async canRequest(scope: string): Promise<boolean> { return true; }
  async recordRequest(scope: string): Promise<void> {}
  async canResend(scope: string): Promise<boolean> { return true; }
  async recordResend(scope: string): Promise<void> {}
}
