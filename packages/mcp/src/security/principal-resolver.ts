/**
 * @mosaix/mcp — Agent Principal Resolver
 */

export interface MCPPrincipal {
  actorId: string;
  actorType: "human" | "agent" | "service";
  delegatedBy?: string;
  tenantId: string;
  scopes: string[];
  expiresAt: string;
}

export class MCPPrincipalResolver {
  static resolveFromHeader(authHeader?: string): MCPPrincipal {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        actorId: "anonymous-agent",
        actorType: "agent",
        tenantId: "default-tenant",
        scopes: ["mcp:read"],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
    }

    const token = authHeader.replace("Bearer ", "").trim();
    // Simulate token decoding / verification
    return {
      actorId: `agent-${token.slice(0, 8)}`,
      actorType: "agent",
      tenantId: "tenant-001",
      scopes: ["mcp:read", "mcp:write", "mcp:admin"],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
  }
}
