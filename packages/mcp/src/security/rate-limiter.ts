/**
 * @mosaix/mcp — Distributed Agent Rate Limiter (Option 3)
 */

import type { CachePort } from "@mosaix/ports-cache";

export interface RateLimitConfig {
  agentId: string;
  toolName: string;
  maxCalls: number;
  windowMs: number;
}

export class MCPRateLimiter {
  private cachePort: CachePort | undefined = undefined;
  private localCounts = new Map<string, { count: number; resetAt: number }>();

  constructor(cachePort?: CachePort) {
    this.cachePort = cachePort;
  }

  async isAllowed(config: RateLimitConfig): Promise<boolean> {
    const key = `mcp:ratelimit:${config.agentId}:${config.toolName}`;

    if (this.cachePort) {
      try {
        const count = (await this.cachePort.get<number>(key)) ?? 0;
        if (count >= config.maxCalls) return false;
        await this.cachePort.set(key, count + 1, { ttl: Math.ceil(config.windowMs / 1000) });
        return true;
      } catch {
        // Fallback to local memory limiter if distributed cache is unreachable
      }
    }

    const now = Date.now();
    let entry = this.localCounts.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + config.windowMs };
      this.localCounts.set(key, entry);
    }

    if (entry.count >= config.maxCalls) {
      return false;
    }

    entry.count++;
    return true;
  }
}

export const mcpRateLimiter = new MCPRateLimiter();
