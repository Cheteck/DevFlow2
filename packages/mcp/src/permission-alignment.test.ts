import { describe, expect, it } from "vitest";
import { MCPToolRegistry } from "./tool-registry.js";
import { MCPPromptRegistry } from "./prompt-registry.js";
import { AppToolProvider } from "./providers/app.js";
import { IntelligenceToolProvider } from "./providers/intelligence.js";
import { registerPortfolioTools } from "./providers/portfolio.js";
import { WorkflowToolProvider } from "./providers/workflows.js";

// MCP-02 regression: every requiredPermission used by a registered tool
// must exist in a BAC manifest (apps mosaic json) or be an explicit
// platform scope. No phantom permission strings.
const KNOWN_PERMISSIONS = new Set([
  "portfolio:vendable:create:tenant",
  "portfolio:vendable:read:tenant",
  "portfolio:vendable:publish:tenant",
  "portfolio:vendable:search:tenant",
  "imperia:governance:inspect",
  "imperia:governance:audit",
  "imperia:topology:query",
  "commerce:order:create",
  "commerce:order:read",
  "booking:slot:create",
  "booking:slot:read",
  "booking:reservation:create",
  "beam:message:send",
  "beam:conversation:read",
  "spaces:space:create",
  "spaces:space:manage",
  "spaces:space:read",
  "citadelle:user:create:tenant",
  "citadelle:user:read:tenant",
  "inventory:stock:read:tenant",
  "inventory:restock:subscribe",
  "mosaix:read",
  "platform:admin:read",
]);

describe("MCP permission alignment (MCP-02)", () => {
  it("uses no phantom permission strings", () => {
    const tools = new MCPToolRegistry();
    AppToolProvider.register(tools);
    IntelligenceToolProvider.register(tools);
    registerPortfolioTools(tools, {
      searchVendables: async () => [],
      readVendable: async () => undefined,
    });
    WorkflowToolProvider.register(tools, new MCPPromptRegistry());

    const phantom = tools
      .listTools()
      .filter((t) => !KNOWN_PERMISSIONS.has(t.requiredPermission))
      .map((t) => t.name + " -> " + t.requiredPermission);

    expect(phantom).toEqual([]);
  });
});
