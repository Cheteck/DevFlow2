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
import { IntelligenceToolProvider } from "./providers/intelligence.js";
import {
  registerPortfolioTools,
  registerPortfolioResources,
  registerPortfolioPrompts,
  createPortfolioBACClient,
  type PortfolioModuleLike,
} from "./providers/portfolio.js";
import { WorkflowToolProvider } from "./providers/workflows.js";

// Register all providers
PlatformToolProvider.register(mcpToolRegistry, mcpResourceRegistry);
AppToolProvider.register(mcpToolRegistry);
IntelligenceToolProvider.register(mcpToolRegistry);
WorkflowToolProvider.register(mcpToolRegistry, mcpPromptRegistry);

/**
 * Wires deterministic Portfolio tools to the real BAC via dynamic import
 * (no static `packages/*` → `@apps/*` dependency). Tries the workspace
 * package first, then the BAC sources directly (dist may not be built).
 * When neither resolves the tools stay unregistered — honest absence, never stubs.
 */
async function wirePortfolioTools(): Promise<void> {
  const candidates = [
    "@apps/portfolio",
    new URL("../../../apps/portfolio/src/index.ts", import.meta.url).href,
  ];
  let portfolio: PortfolioModuleLike | null = null;
  let lastError: unknown = null;
  for (const specifier of candidates) {
    try {
      // NOTE: never `as typeof portfolio` — the self-referential query freezes
      // the narrowed type to `null` and poisons every later use to `never`.
      portfolio = (await import(specifier)) as PortfolioModuleLike;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!portfolio) {
    console.error(
      "[mcp-server] portfolio tools unwired (@apps/portfolio not resolvable):",
      lastError instanceof Error ? lastError.message : String(lastError),
    );
    return;
  }
  try {
    const service = new portfolio.PortfolioService(
      // eslint-disable-next-line no-restricted-syntax -- transport stdio sans DatabasePort par construction : store ephemere documente (honnete absence de persistance, jamais du stockage silencieux).
      new portfolio.InMemoryVendableRepository(),
    );
    const client = createPortfolioBACClient(service);
    registerPortfolioTools(mcpToolRegistry, client);
    registerPortfolioResources(mcpResourceRegistry, client);
  } catch (err) {
    console.error(
      "[mcp-server] portfolio tools unwired (@apps/portfolio not resolvable):",
      err instanceof Error ? err.message : String(err),
    );
  }
  registerPortfolioPrompts(mcpPromptRegistry);
}

await wirePortfolioTools();

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
        // JSON-RPC notifications (no id) expect no response on stdio.
        if (response) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
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
