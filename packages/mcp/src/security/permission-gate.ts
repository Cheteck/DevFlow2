/**
 * @mosaix/mcp — Agent Permission Gate
 */

import type { MCPPrincipal } from "./principal-resolver";
import { MCPAuditLogger, mcpAuditLogger } from "./audit-logger";

export class MCPPermissionGate {
  private auditLogger: MCPAuditLogger;

  constructor(auditLogger = mcpAuditLogger) {
    this.auditLogger = auditLogger;
  }

  authorize(toolName: string, requiredPermission: string, principal: MCPPrincipal): boolean {
    const startTime = Date.now();
    // Wildcard or explicit scope check
    const hasScope = principal.scopes.includes("mcp:admin") || principal.scopes.includes(requiredPermission);

    this.auditLogger.log({
      requestId: `req-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      actorId: principal.actorId,
      tenantId: principal.tenantId,
      toolName,
      permission: requiredPermission,
      decision: hasScope ? "GRANTED" : "DENIED",
      latencyMs: Date.now() - startTime,
    });

    return hasScope;
  }
}

export const mcpPermissionGate = new MCPPermissionGate();
