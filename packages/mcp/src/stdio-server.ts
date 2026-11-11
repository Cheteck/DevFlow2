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
import {
  registerSpacesTools,
  registerSpacesResources,
  registerSpacesPrompts,
  createSpacesBACClient,
  type SpacesModuleLike,
} from "./providers/spaces.js";
import {
  registerCommerceTools,
  registerCommerceResources,
  registerCommercePrompts,
  createCommerceBACClient,
  type CommerceModuleLike,
} from "./providers/commerce.js";
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

/**
 * Wires deterministic Spaces tools to the real BAC via dynamic import.
 * Stdio transport has no DatabasePort by construction → in-memory
 * SpaceService (honest ephemeral parity, never silent storage).
 */
async function wireSpacesTools(): Promise<void> {
  const candidates = [
    "@apps/spaces",
    new URL("../../../apps/spaces/src/index.ts", import.meta.url).href,
  ];
  let spaces: SpacesModuleLike | null = null;
  let lastError: unknown = null;
  for (const specifier of candidates) {
    try {
      spaces = (await import(specifier)) as SpacesModuleLike;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!spaces) {
    console.error(
      "[mcp-server] spaces tools unwired (@apps/spaces not resolvable):",
      lastError instanceof Error ? lastError.message : String(lastError),
    );
    return;
  }
  try {
    const service = new spaces.SpaceService(undefined);
    const client = createSpacesBACClient(service);
    registerSpacesTools(mcpToolRegistry, client);
    registerSpacesResources(mcpResourceRegistry, client);
  } catch (err) {
    console.error(
      "[mcp-server] spaces tools unwired (@apps/spaces not resolvable):",
      err instanceof Error ? err.message : String(err),
    );
  }
  registerSpacesPrompts(mcpPromptRegistry);
}

await wirePortfolioTools();
await wireSpacesTools();
await wireCommerceTools();

/**
 * Wires deterministic Commerce tools to the real BAC via dynamic import.
 * Stdio transport has no DatabasePort by construction → in-memory
 * CommerceOfferService (honest ephemeral parity, never silent storage).
 */
async function wireCommerceTools(): Promise<void> {
  const candidates = [
    "@apps/commerce",
    new URL("../../../apps/commerce/src/index.ts", import.meta.url).href,
  ];
  let commerce: CommerceModuleLike | null = null;
  let lastError: unknown = null;
  for (const specifier of candidates) {
    try {
      commerce = (await import(specifier)) as CommerceModuleLike;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!commerce) {
    console.error(
      "[mcp-server] commerce tools unwired (@apps/commerce not resolvable):",
      lastError instanceof Error ? lastError.message : String(lastError),
    );
    return;
  }
  try {
    const service = new commerce.CommerceOfferService(undefined);
    const client = createCommerceBACClient(service);
    registerCommerceTools(mcpToolRegistry, client);
    registerCommerceResources(mcpResourceRegistry, client);
  } catch (err) {
    console.error(
      "[mcp-server] commerce tools unwired (@apps/commerce not resolvable):",
      err instanceof Error ? err.message : String(err),
    );
  }
  registerCommercePrompts(mcpPromptRegistry);
}

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
        const authHeader = process.env.MCP_AUTH_TOKEN
          ? (process.env.MCP_AUTH_TOKEN.startsWith("Bearer ") ? process.env.MCP_AUTH_TOKEN : `Bearer ${process.env.MCP_AUTH_TOKEN}`)
          : undefined;
        const response = await gateway.handleRequest(request, authHeader ? { authHeader } : undefined);
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
