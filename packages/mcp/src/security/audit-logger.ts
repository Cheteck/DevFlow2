/**
 * @mosaix/mcp — Agent Audit Logger
 */

export interface MCPAuditEntry {
  requestId: string;
  timestamp: string;
  actorId: string;
  tenantId: string;
  toolName: string;
  permission: string;
  decision: "GRANTED" | "DENIED" | "ERROR";
  latencyMs: number;
}

export class MCPAuditLogger {
  private logs: MCPAuditEntry[] = [];

  log(entry: MCPAuditEntry): void {
    this.logs.push(entry);
  }

  getLogs(): MCPAuditEntry[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

export const mcpAuditLogger = new MCPAuditLogger();
