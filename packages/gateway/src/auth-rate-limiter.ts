/**
 * @mosaix/gateway — Auth Rate Limiting Middleware (Brute-Force Protection)
 *
 * Tracks login/registration attempts per IP address to mitigate brute-force attacks
 * on authentication endpoints (e.g. /login, /register, /auth/*).
 */

import type { HttpRequest, HttpResponse } from "@mosaix/http";
import { RateLimiter, type RateLimiterOptions } from "./rate-limiter";

export interface AuthRateLimiterOptions {
  /**
   * List of path endpoints or patterns to rate limit (e.g., ["/api/auth/login", "/api/auth/register", "/auth/*"]).
   * Defaults to common auth endpoints if not provided.
   */
  authEndpoints?: string[];

  /**
   * Maximum allowed attempts within the refill window.
   * Defaults to 5 attempts.
   */
  maxAttempts?: number;

  /**
   * Token refill rate per second.
   * Defaults to 0.1 (i.e., 1 attempt refilled every 10 seconds).
   */
  refillRatePerSecond?: number;

  /**
   * RateLimiter configuration or existing instance options.
   */
  rateLimiterOptions?: RateLimiterOptions;
}

export class AuthRateLimiterMiddleware {
  private readonly rateLimiter: RateLimiter;
  private readonly authEndpoints: string[];

  constructor(options: AuthRateLimiterOptions = {}) {
    this.authEndpoints = options.authEndpoints ?? [
      "/api/auth/login",
      "/api/auth/register",
      "/api/user/switch",
      "/auth/login",
      "/auth/register",
      "/auth/*",
    ];

    if (options.rateLimiterOptions) {
      this.rateLimiter = new RateLimiter(options.rateLimiterOptions);
    } else {
      this.rateLimiter = new RateLimiter({
        capacity: options.maxAttempts ?? 5,
        refillRatePerSecond: options.refillRatePerSecond ?? 0.1, // 1 token every 10 seconds
      });
    }
  }

  /**
   * Checks whether the request target matches any configured auth endpoint.
   */
  isAuthEndpoint(path: string): boolean {
    const cleanPath = path.split("?")[0] ?? "/";
    return this.authEndpoints.some((endpoint) => {
      if (endpoint.includes("*")) {
        const pattern = endpoint
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*");
        return new RegExp(`^${pattern}$`).test(cleanPath);
      }
      return cleanPath === endpoint;
    });
  }

  /**
   * Middleware handler for HTTP requests.
   */
  async handle(
    req: HttpRequest,
    next: () => Promise<HttpResponse>,
    ipAddress?: string
  ): Promise<HttpResponse> {
    if (this.isAuthEndpoint(req.path)) {
      const ip =
        ipAddress ??
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        req.headers["x-real-ip"] ??
        "127.0.0.1";

      const key = `auth_bruteforce:${ip}:${req.path.split("?")[0]}`;
      const result = await this.rateLimiter.consume(key);

      if (!result.allowed) {
        return {
          statusCode: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "60",
          },
          body: {
            error: "Too Many Requests",
            message: "Too many authentication attempts. Please try again later.",
            remaining: result.remaining,
          },
        };
      }
    }

    return next();
  }
}
