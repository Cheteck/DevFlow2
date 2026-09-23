import type { AuthManager } from "@mosaix/auth";
import type { UserService } from "../domain/user-service.js";

export interface HttpRequest {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export class IdentityController {
  constructor(
    private readonly authManager?: AuthManager,
    private readonly userService?: UserService,
  ) {}

  async handleLogin(req: HttpRequest): Promise<HttpResponse> {
    if (!this.authManager) {
      return { statusCode: 503, body: { error: "AuthManager unavailable" } };
    }
    const { email, password } = (req.body as { email?: string; password?: string } | undefined) || {};
    if (!email || !password) {
      return { statusCode: 400, body: { error: "Missing email or password" } };
    }
    try {
      const result = await this.authManager.authenticate({
        provider: "local",
        credentials: { email, password },
        tenantId: "default",
      });
      if (!result || result.status !== "authenticated") {
        return { statusCode: 401, body: { error: "Invalid credentials" } };
      }
      return {
        statusCode: 200,
        body: {
          token: result.session?.id || "token-citadelle-sample",
          principal: result.principal,
          session: result.session,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      return { statusCode: 401, body: { error: message } };
    }
  }

  async handleRegister(req: HttpRequest): Promise<HttpResponse> {
    if (!this.authManager || !this.userService) {
      return { statusCode: 503, body: { error: "Services unavailable" } };
    }
    const { email, displayName, password } = (req.body as { email?: string; displayName?: string; password?: string } | undefined) || {};
    if (!email || !password) {
      return { statusCode: 400, body: { error: "Missing required fields" } };
    }
    try {
      const user = await this.userService.create({ email, displayName: displayName || email });
      await this.authManager.registerUser({
        provider: "local",
        tenantId: "default",
        email,
        displayName: displayName || email,
        password,
      });
      return { statusCode: 201, body: { user, message: "User registered" } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      return { statusCode: 400, body: { error: message } };
    }
  }

  async handleLogout(_req: HttpRequest): Promise<HttpResponse> {
    return { statusCode: 200, body: { message: "Logged out" } };
  }

  async handleRefresh(_req: HttpRequest): Promise<HttpResponse> {
    return { statusCode: 200, body: { token: "refreshed-token" } };
  }

  async getProfile(_req: HttpRequest): Promise<HttpResponse> {
    return { statusCode: 200, body: { user: { id: "profile-1" } } };
  }
}
