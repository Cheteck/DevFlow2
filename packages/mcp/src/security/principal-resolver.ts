/**
 * @mosaix/mcp — Agent Principal Resolver
 */

import { JwtService, resolveJwtSecrets } from "@mosaix/auth";

export interface MCPPrincipal {
  actorId: string;
  actorType: "human" | "agent" | "service";
  delegatedBy?: string;
  tenantId: string;
  scopes: string[];
  expiresAt: string;
}

export class MCPPrincipalResolver {
  private static jwtServiceInstance: JwtService | null = null;

  private static getJwtService(): JwtService {
    if (!this.jwtServiceInstance) {
      const { current, previous } = resolveJwtSecrets();
      this.jwtServiceInstance = new JwtService({
        secret: current,
        previousSecrets: previous,
      });
    }
    return this.jwtServiceInstance;
  }

  /** Visible for testing or custom JWT configuration */
  static setJwtService(jwtService: JwtService | null): void {
    this.jwtServiceInstance = jwtService;
  }

  static resolveFromHeader(authHeader?: string): MCPPrincipal {
    const anonymousPrincipal: MCPPrincipal = {
      actorId: "anonymous-agent",
      actorType: "agent",
      tenantId: "default-tenant",
      scopes: ["mcp:read"],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return anonymousPrincipal;
    }

    const jwtService = this.getJwtService();
    const payload = jwtService.verify(authHeader);

    if (!payload) {
      return anonymousPrincipal;
    }

    const scopes = new Set<string>();
    /* AUDIT-RESET a055b8e (2026-10-13) — AUCUNE PERTE DÉTECTÉE.
     * Cast de type uniquement (payload.scopes), sans changement de comportement : correspond au "build
     * 0 erreur" de la session. Fait partie du batch "and 14 more". Relancer les tests d'alignement
     * des permissions MCP après toute restauration. */
    if (Array.isArray((payload as unknown as Record<string, unknown>).scopes)) {
      ((payload as unknown as Record<string, unknown>).scopes as string[]).forEach((s) => scopes.add(s));
    }
    if (Array.isArray(payload.permissions)) {
      payload.permissions.forEach((p) => scopes.add(p));
    }
    if (Array.isArray(payload.roles) && payload.roles.includes("admin")) {
      scopes.add("mcp:admin");
    }

    const expiresAt = payload.exp
      ? new Date(payload.exp * 1000).toISOString()
      : new Date(Date.now() + 3600000).toISOString();

    return {
      actorId: payload.sub,
      actorType: "agent",
      tenantId: payload.tenantId || "default-tenant",
      scopes: Array.from(scopes),
      expiresAt,
    };
  }
}
