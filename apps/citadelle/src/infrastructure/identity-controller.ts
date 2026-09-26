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

  async handleLogout(req: HttpRequest): Promise<HttpResponse> {
    if (!this.authManager) {
      return { statusCode: 503, body: { error: "AuthManager unavailable" } };
    }
    const authHeader = req.headers?.["authorization"] || req.headers?.["Authorization"];
    const sessionId = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers?.["x-session-id"] || "");
    if (sessionId) {
      try {
        await this.authManager.revokeSession(sessionId);
      } catch {
        // ignore if session was already revoked
      }
    }
    return { statusCode: 200, body: { message: "Logged out successfully", revokedSessionId: sessionId || null } };
  }

  async handleRefresh(req: HttpRequest): Promise<HttpResponse> {
    if (!this.authManager) {
      return { statusCode: 503, body: { error: "AuthManager unavailable" } };
    }
    const authHeader = req.headers?.["authorization"] || req.headers?.["Authorization"];
    const sessionId = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers?.["x-session-id"] || "");
    const bodyObj = (req.body as { sessionId?: string; identityId?: string; tenantId?: string } | undefined);
    const targetSessionId = sessionId || bodyObj?.sessionId;
    const identityId = bodyObj?.identityId;
    const tenantId = bodyObj?.tenantId || "default";

    if (!targetSessionId && !identityId) {
      return { statusCode: 400, body: { error: "Missing session or identity identifier for token refresh" } };
    }

    try {
      if (targetSessionId) {
        try { await this.authManager.revokeSession(targetSessionId); } catch { /* ignore */ }
      }
      if (identityId) {
        const newSession = await this.authManager.createSession(identityId, tenantId);
        return { statusCode: 200, body: { token: newSession.id, session: newSession } };
      }
      return { statusCode: 200, body: { message: "Session refreshed", token: targetSessionId } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Token refresh failed";
      return { statusCode: 400, body: { error: message } };
    }
  }

  async getProfile(req: HttpRequest): Promise<HttpResponse> {
    if (!this.userService) {
      return { statusCode: 503, body: { error: "UserService unavailable" } };
    }
    const authHeader = req.headers?.["authorization"] || req.headers?.["Authorization"];
    const userId = req.headers?.["x-user-id"] || (req.body as { userId?: string } | undefined)?.userId;
    const email = (req.body as { email?: string } | undefined)?.email;

    if (!userId && !email && !authHeader) {
      return { statusCode: 400, body: { error: "Missing user identification parameters" } };
    }

    try {
      const user = await this.userService.lookup({ id: userId, email });
      if (!user) {
        return { statusCode: 404, body: { error: "User profile not found" } };
      }
      return { statusCode: 200, body: { user } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch user profile";
      return { statusCode: 500, body: { error: message } };
    }
  }
}
