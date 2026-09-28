#!/usr/bin/env tsx
/**
 * @mosaix/mcp — MCP stdio Server Entry Point
 * Run with: pnpm --filter @mosaix/mcp exec tsx src/stdio-server.ts
 * Or from root: pnpm tsx packages/mcp/src/stdio-server.ts
 */

import { MCPGateway } from "./server/gateway.js";
import { mcpToolRegistry } from "./tool-registry.js";
import { mcpResourceRegistry } from "./resource-registry.js";
import { mcpPromptRegistry } from "./prompt-registry.js";
import { PlatformToolProvider } from "./providers/platform.js";
import { AppToolProvider } from "./providers/app.js";
import { WorkflowToolProvider } from "./providers/workflows.js";

// Register all providers
PlatformToolProvider.register(mcpToolRegistry, mcpResourceRegistry);
AppToolProvider.register(mcpToolRegistry);
WorkflowToolProvider.register(mcpToolRegistry, mcpPromptRegistry);

const gateway = new MCPGateway();

async function main() {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of process.stdin) {
    buffer += decoder.decode(chunk, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;

      try {
        const request = JSON.parse(line);
        const response = await gateway.handleRequest(request);
        process.stdout.write(JSON.stringify(response) + "\n");
      } catch (_err) {
        const errorResponse = {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        };
        process.stdout.write(JSON.stringify(errorResponse) + "\n");
      }
    }
  }
}

main().catch((err) => {
  console.error("[mcp-server] fatal:", err);
  process.exit(1);
});
