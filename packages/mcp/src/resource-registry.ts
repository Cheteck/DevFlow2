/**
 * @mosaix/mcp — MCP Resource Registry
 */

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
  requiredPermission: string;
  resolver: (uri: string) => Promise<unknown>;
}

export class MCPResourceRegistry {
  private resources = new Map<string, MCPResourceDefinition>();

  registerResource(resource: MCPResourceDefinition): void {
    this.resources.set(resource.uri, resource);
  }

  getResource(uri: string): MCPResourceDefinition | undefined {
    return this.resources.get(uri);
  }

  listResources(): Omit<MCPResourceDefinition, "resolver">[] {
    return Array.from(this.resources.values()).map(({ resolver: _resolver, ...def }) => def);
  }

  clear(): void {
    this.resources.clear();
  }
}

export const mcpResourceRegistry = new MCPResourceRegistry();
