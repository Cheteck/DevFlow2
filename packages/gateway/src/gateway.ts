/**
 * @mosaix/gateway — Native HTTP Gateway with Pipeline & Automatic OpenAPI Endpoint
 */

import * as http from "node:http";
import * as crypto from "node:crypto";
import { OpenApiGenerator, CorsMiddleware, SecurityHeadersMiddleware, type CorsOptions, type Router } from "@mosaix/http";
import { Pipeline } from "@mosaix/pipeline";
import { JwtService } from "@mosaix/auth";
import { RateLimiter, type RateLimiterOptions } from "./rate-limiter";
import { AuthRateLimiterMiddleware, type AuthRateLimiterOptions } from "./auth-rate-limiter";
import { incrementRequestCounter, otlpTraceExporter } from "@mosaix/telemetry";

const { randomUUID } = crypto;

export interface GatewayAuthOptions {
  jwtSecret: string;
  publicRoutes?: string[];
}

export interface GatewayTelemetryOptions {
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  batchSize?: number;
}

export interface GatewayConfig {
  port: number;
  router: Router;
  title?: string;
  version?: string;
  host?: string;
  trustProxy?: boolean;
  rateLimiterOptions?: RateLimiterOptions;
  authRateLimiterOptions?: AuthRateLimiterOptions;
  authOptions?: GatewayAuthOptions;
  telemetryOptions?: GatewayTelemetryOptions;
  corsOptions?: CorsOptions;
}

interface JwtPayload {
  sub: string;
  tenantId: string;
  roles?: string[];
  permissions?: string[];
  capabilities?: string[];
  exp?: number;
}

export function validateJwt(token: string, secret: string): JwtPayload | null {
  try {
    const service = new JwtService({ secret });
    return service.verify(token);
  } catch {
    return null;
  }
}

export function isPublicRoute(url: string, publicRoutes?: string[]): boolean {
  if (!publicRoutes || publicRoutes.length === 0) return false;
  const path = url.split("?")[0] ?? "/";
  return publicRoutes.some((route) => {
    if (route.includes("*")) {
      const pattern = route
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      return new RegExp(`^${pattern}$`).test(path);
    }
    return path === route;
  });
}

export class Gateway {
  private server?: http.Server;
  private config: GatewayConfig;
  private rateLimiter?: RateLimiter;
  private authRateLimiter?: AuthRateLimiterMiddleware;
  private jwtService?: JwtService;
  private corsOptions: CorsOptions;
  private pipeline = new Pipeline<{ req: http.IncomingMessage; res: http.ServerResponse; body: unknown }>();

  constructor(config: GatewayConfig) {
    this.config = config;
    if (config.rateLimiterOptions) {
      this.rateLimiter = new RateLimiter(config.rateLimiterOptions);
    }
    if (config.authRateLimiterOptions) {
      this.authRateLimiter = new AuthRateLimiterMiddleware(config.authRateLimiterOptions);
    }
    if (config.authOptions) {
      try {
        this.jwtService = new JwtService({ secret: config.authOptions.jwtSecret });
      } catch (err) {
        console.warn("[Gateway] Invalid JWT secret, auth disabled:", err);
      }
    }
    if (config.telemetryOptions) {
      otlpTraceExporter.configure({
        ...(config.telemetryOptions.otlpEndpoint ? { endpoint: config.telemetryOptions.otlpEndpoint } : {}),
        ...(config.telemetryOptions.otlpHeaders ? { headers: config.telemetryOptions.otlpHeaders } : {}),
        ...(config.telemetryOptions.batchSize !== undefined ? { batchSize: config.telemetryOptions.batchSize } : {}),
      });
    }
    this.corsOptions = CorsMiddleware.resolveOptions(config.corsOptions ?? {});

    const trustProxy = Boolean(config.trustProxy ?? (process.env.TRUST_PROXY === "true"));
    const resolveClientIp = (req: http.IncomingMessage): string => {
      if (trustProxy) {
        const forwarded = req.headers["x-forwarded-for"];
        if (typeof forwarded === "string") {
          const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
          if (parts.length > 0) return parts[0];
        }
      }
      return req.socket.remoteAddress ?? "127.0.0.1";
    };

    // Attach default onion-style pipeline middleware
    this.pipeline.pipe(async (ctx, next) => {
      const clientIp = resolveClientIp(ctx.req);

      // Check general rate limiter if configured
      if (this.rateLimiter) {
        const rateResult = await this.rateLimiter.consume(clientIp);
        if (!rateResult.allowed) {
          ctx.res.statusCode = 429;
          ctx.res.setHeader("content-type", "application/json");
          incrementRequestCounter(429);
          ctx.res.end(JSON.stringify({ error: "Too Many Requests", remaining: rateResult.remaining }));
          return;
        }
      }

      // Check auth-specific rate limiter to mitigate brute-force attempts
      if (this.authRateLimiter) {
        const reqPath = ctx.req.url ?? "/";
        const reqHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(ctx.req.headers)) {
          if (typeof v === "string") reqHeaders[k] = v;
        }

        const authResult = await this.authRateLimiter.handle(
          {
            method: ctx.req.method ?? "GET",
            path: reqPath,
            headers: reqHeaders,
          },
          async () => ({ statusCode: 200 }),
          clientIp
        );

        if (authResult.statusCode === 429) {
          ctx.res.statusCode = 429;
          ctx.res.setHeader("content-type", "application/json");
          ctx.res.setHeader("retry-after", "60");
          incrementRequestCounter(429);
          ctx.res.end(JSON.stringify(authResult.body));
          return;
        }
      }

      // JWT authentication middleware — validates bearer tokens for protected routes
      if (this.config.authOptions && !isPublicRoute(ctx.req.url ?? "/", this.config.authOptions.publicRoutes)) {
        const authHeader = ctx.req.headers.authorization;
        const token = typeof authHeader === "string" ? authHeader : undefined;

        if (!token) {
          ctx.res.statusCode = 401;
          ctx.res.setHeader("content-type", "application/json");
          incrementRequestCounter(401);
          ctx.res.end(JSON.stringify({ error: "Unauthorized", message: "Missing Authorization header" }));
          return;
        }

        const payload = this.jwtService?.verify(token) ?? validateJwt(token, this.config.authOptions.jwtSecret);
        if (!payload) {
          ctx.res.statusCode = 401;
          ctx.res.setHeader("content-type", "application/json");
          incrementRequestCounter(401);
          ctx.res.end(JSON.stringify({ error: "Unauthorized", message: "Invalid or expired token" }));
          return;
        }

        // Attach authenticated principal to request context for downstream handlers
        (ctx.req as unknown as Record<string, unknown>).mosaixPrincipal = payload;
      }

      // Check for automatic /openapi.json specification route
      const url = ctx.req.url?.split("?")[0] ?? "/";
      if (url === "/openapi.json" && (ctx.req.method === "GET" || ctx.req.method === "HEAD")) {
        const spec = OpenApiGenerator.generateSpec(
          this.config.title ?? "MosaiX Gateway API",
          this.config.version ?? "1.0.0",
          this.config.router.getRoutes()
        );
        ctx.res.statusCode = 200;
        ctx.res.setHeader("content-type", "application/json");
        ctx.res.end(JSON.stringify(spec));
        return;
      }
      await next();
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (nodeReq, nodeRes) => {
        let bodyStr = "";
        nodeReq.on("data", (chunk) => {
          bodyStr += chunk;
        });

        nodeReq.on("end", async () => {
          const traceId = randomUUID();
          const spanId = randomUUID();
          const startTime = Date.now();

          let bodyParsed: unknown;
          if (bodyStr) {
            try {
              bodyParsed = JSON.parse(bodyStr);
            } catch {
              bodyParsed = bodyStr;
            }
          }

          // Process through onion-style Pipeline
          await this.pipeline.process({ req: nodeReq, res: nodeRes, body: bodyParsed });

          if (nodeRes.writableEnded) {
            const durationMs = Date.now() - startTime;
            void otlpTraceExporter.exportSpan({
              traceId,
              spanId,
              name: `${nodeReq.method ?? "GET"} ${nodeReq.url?.split("?")[0] ?? "/"}`,
              startTime,
              durationMs,
              attributes: { method: nodeReq.method ?? "GET", path: nodeReq.url?.split("?")[0] ?? "/", statusCode: "early_return" },
            });
            return;
          }

          const reqHeaders = (nodeReq.headers as Record<string, string>) ?? {};
          const principal = (nodeReq as unknown as Record<string, unknown>).mosaixPrincipal as
            | { sub: string; tenantId: string; roles?: string[]; permissions?: string[]; capabilities?: string[] }
            | undefined;
          const response = await this.config.router.handle({
            method: nodeReq.method ?? "GET",
            path: nodeReq.url?.split("?")[0] ?? "/",
            headers: reqHeaders,
            body: bodyParsed,
            ...(principal ? { principal } : {}),
          });

          nodeRes.statusCode = response.statusCode;
          incrementRequestCounter(response.statusCode);
          const outHeaders: Record<string, string> = { ...(response.headers ?? {}) };
          SecurityHeadersMiddleware.applySecurityHeaders(outHeaders);
          CorsMiddleware.applyCors({ method: nodeReq.method ?? "GET", path: nodeReq.url ?? "/", headers: reqHeaders }, outHeaders, this.corsOptions);

          for (const [key, val] of Object.entries(outHeaders)) {
            nodeRes.setHeader(key, val);
          }

          if (response.body !== undefined) {
            nodeRes.end(typeof response.body === "string" ? response.body : JSON.stringify(response.body));
          } else {
            nodeRes.end();
          }

          const durationMs = Date.now() - startTime;
          void otlpTraceExporter.exportSpan({
            traceId,
            spanId,
            name: `${nodeReq.method ?? "GET"} ${nodeReq.url?.split("?")[0] ?? "/"}`,
            startTime,
            durationMs,
            attributes: {
              method: nodeReq.method ?? "GET",
              path: nodeReq.url?.split("?")[0] ?? "/",
              statusCode: String(response.statusCode),
            },
          });
        });
      });

      this.server.once("error", (err: NodeJS.ErrnoException) => {
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host ?? "0.0.0.0", () => {
        resolve();
      });
    });
  }

  getAddress(): { port: number; host: string } | null {
    return this.server?.address() as { port: number; host: string } | null;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          void otlpTraceExporter.flush();
          resolve();
        });
      } else {
        void otlpTraceExporter.flush();
        resolve();
      }
    });
  }
}
