/**
 * @mosaix/http — HTTP Primitives & Controller
 */

export interface AuthenticatedPrincipal {
  sub: string;
  tenantId: string;
  roles?: string[];
  permissions?: string[];
  capabilities?: string[];
}

export interface HttpRequest<TBody = unknown> {
  method: string;
  path: string;
  headers: Record<string, string>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: TBody;
  /** Validated JWT principal forwarded by the Gateway (undefined for public/anonymous). */
  principal?: AuthenticatedPrincipal;
}

export interface HttpResponse<TBody = unknown> {
  statusCode: number;
  headers?: Record<string, string>;
  body?: TBody;
}

export abstract class Controller {
  protected json<T>(data: T, statusCode = 200, headers: Record<string, string> = {}): HttpResponse<T> {
    return {
      statusCode,
      headers: { "content-type": "application/json", ...headers },
      body: data,
    };
  }

  protected created<T>(data: T): HttpResponse<T> {
    return this.json(data, 201);
  }

  protected noContent(): HttpResponse<null> {
    return { statusCode: 204 };
  }

  protected badRequest(message: string): HttpResponse<{ error: string }> {
    return this.json({ error: message }, 400);
  }

  protected notFound(message = "Not Found"): HttpResponse<{ error: string }> {
    return this.json({ error: message }, 404);
  }

  protected internalError(message = "Internal Server Error", statusCode = 500): HttpResponse<{ error: string }> {
    return this.json({ error: message }, statusCode);
  }
}

export type RouteHandler = (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;

export interface RouteDefinition {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: RouteHandler;
}

export class Router {
  private routes: RouteDefinition[] = [];

  get(path: string, handler: RouteHandler): this {
    this.routes.push({ method: "GET", path, handler });
    return this;
  }

  post(path: string, handler: RouteHandler): this {
    this.routes.push({ method: "POST", path, handler });
    return this;
  }

  put(path: string, handler: RouteHandler): this {
    this.routes.push({ method: "PUT", path, handler });
    return this;
  }

  delete(path: string, handler: RouteHandler): this {
    this.routes.push({ method: "DELETE", path, handler });
    return this;
  }

  getRoutes(): ReadonlyArray<RouteDefinition> {
    return this.routes;
  }

  async handle(req: HttpRequest): Promise<HttpResponse> {
    const route = this.routes.find(
      (r) => r.method === req.method.toUpperCase() && r.path === req.path
    );

    if (!route) {
      return { statusCode: 404, body: { error: "Route not found" } };
    }

    return route.handler(req);
  }
}

export interface CorsOptions {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
}

export class CorsMiddleware {
  static applyCors(req: HttpRequest, resHeaders: Record<string, string>, options: CorsOptions = {}): void {
    const origins = options.allowedOrigins ?? CorsMiddleware.defaultOrigins();
    const origin = req.headers["origin"] ?? "*";
    resHeaders["access-control-allow-origin"] = origins.includes("*") ? "*" : (origins.includes(origin) ? origin : origins[0] ?? "*");
    resHeaders["access-control-allow-methods"] = (options.allowedMethods ?? ["GET", "POST", "PUT", "DELETE", "OPTIONS"]).join(", ");
    resHeaders["access-control-allow-headers"] = (options.allowedHeaders ?? ["content-type", "authorization", "x-mosaix-tenant-id"]).join(", ");
  }

  static defaultOrigins(): string[] {
    const envOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
    if (envOrigins && envOrigins.length > 0) return envOrigins;
    if (process.env.NODE_ENV === "production") {
      console.warn("[Security] CORS_ALLOWED_ORIGINS not set in production — defaulting to no wildcard. Set CORS_ALLOWED_ORIGINS explicitly.");
      return [];
    }
    return ["*"];
  }

  static resolveOptions(overrides: CorsOptions = {}): CorsOptions {
    if (overrides.allowedOrigins) return overrides;
    return { ...overrides, allowedOrigins: CorsMiddleware.defaultOrigins() };
  }
}

export class SecurityHeadersMiddleware {
  static applySecurityHeaders(resHeaders: Record<string, string>): void {
    resHeaders["x-content-type-options"] = "nosniff";
    resHeaders["x-frame-options"] = "DENY";
    resHeaders["x-xss-protection"] = "1; mode=block";
    resHeaders["strict-transport-security"] = "max-age=31536000; includeSubDomains";
    resHeaders["content-security-policy"] = "default-src 'self' 'unsafe-inline' 'unsafe-eval';";
  }
}
