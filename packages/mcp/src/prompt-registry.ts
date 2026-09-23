/**
 * @mosaix/mcp — MCP Prompt Registry
 */

export interface MCPPromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{ name: string; description: string; required?: boolean }>;
  handler: (args: Record<string, string>) => Promise<Array<{ role: string; content: { type: string; text: string } }>>;
}

export class MCPPromptRegistry {
  private prompts = new Map<string, MCPPromptDefinition>();

  registerPrompt(prompt: MCPPromptDefinition): void {
    this.prompts.set(prompt.name, prompt);
  }

  getPrompt(name: string): MCPPromptDefinition | undefined {
    return this.prompts.get(name);
  }

  listPrompts(): Omit<MCPPromptDefinition, "handler">[] {
    return Array.from(this.prompts.values()).map(({ handler: _handler, ...def }) => def);
  }

  clear(): void {
    this.prompts.clear();
  }
}

export const mcpPromptRegistry = new MCPPromptRegistry();
