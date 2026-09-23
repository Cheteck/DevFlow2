/**
 * @mosaix/mcp — MCP Tool Registry
 */

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  requiredPermission: string;
  ownerApp: string;
  handler: (input: unknown, context?: unknown) => Promise<unknown>;
}

export class MCPToolRegistry {
  private tools = new Map<string, MCPToolDefinition>();

  registerTool(tool: MCPToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  listTools(): Omit<MCPToolDefinition, "handler">[] {
    return Array.from(this.tools.values()).map(({ handler: _handler, ...def }) => def);
  }

  clear(): void {
    this.tools.clear();
  }
}

export const mcpToolRegistry = new MCPToolRegistry();
