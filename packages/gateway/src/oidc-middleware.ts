/**
 * @mosaix/gateway — Zero-Trust JWT/OIDC Auth Middleware
 */

import { OidcTokenBridge } from "@mosaix/auth";
import type { HttpRequest, HttpResponse } from "@mosaix/http";

export class OidcGatewayMiddleware {
  private bridge = new OidcTokenBridge();

  async handle(req: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> {
    const authHeader = req.headers["authorization"] ?? req.headers["Authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const introspection = await this.bridge.introspectToken(token);

      if (!introspection.active) {
        return {
          statusCode: 401,
          headers: { "content-type": "application/json" },
          body: { error: "Unauthorized: Invalid or expired Zero-Trust token." },
        };
      }

      req.headers["x-user-id"] = introspection.sub ?? "";
      req.headers["x-tenant-id"] = introspection.tenantId ?? "";
    }

    return next();
  }
}
