import { describe, it, expect, beforeEach } from "vitest";
import { MCPToolRegistry } from "./tool-registry";
import { MCPResourceRegistry } from "./resource-registry";
import { MCPPromptRegistry } from "./prompt-registry";
import { MCPGateway } from "./server/gateway";
import { MCPPermissionGate } from "./security/permission-gate";
import { MCPAuditLogger } from "./security/audit-logger";
import { MCPRateLimiter } from "./security/rate-limiter";
import { PlatformToolProvider } from "./providers/platform";
import { AppToolProvider } from "./providers/app";
import { WorkflowToolProvider } from "./providers/workflows";

describe("MosaiX MCP Server Agent Interoperability Layer", () => {
  let tools: MCPToolRegistry;
  let resources: MCPResourceRegistry;
  let prompts: MCPPromptRegistry;
  let gateway: MCPGateway;
  let auditLogger: MCPAuditLogger;
  let _permissionGate: MCPPermissionGate;
  let rateLimiter: MCPRateLimiter;

  beforeEach(() => {
    tools = new MCPToolRegistry();
    resources = new MCPResourceRegistry();
    prompts = new MCPPromptRegistry();
    gateway = new MCPGateway(tools, resources, prompts);
    auditLogger = new MCPAuditLogger();
    _permissionGate = new MCPPermissionGate(auditLogger);
    rateLimiter = new MCPRateLimiter();
  });

  it("registers and lists platform, BAC, and workflow tools", () => {
    PlatformToolProvider.register(tools, resources);
    AppToolProvider.register(tools);
    WorkflowToolProvider.register(tools, prompts);

    const toolList = tools.listTools();
    expect(toolList.some((t) => t.name === "platform_get_topology")).toBe(true);
    expect(toolList.some((t) => t.name === "identity_user_lookup")).toBe(true);
    expect(toolList.some((t) => t.name === "mosaix_create_business_space")).toBe(true);
  });

  it("executes multi-step agent workflow tool (mosaix_create_business_space)", async () => {
    WorkflowToolProvider.register(tools, prompts);

    const res = await gateway.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "mosaix_create_business_space",
        arguments: {
          spaceName: "Boutique Amel Paris",
          ownerUserId: "usr-amel",
          announcementText: "Bienvenue dans notre boutique!",
        },
      },
    });

    expect(res.result?.content[0].text).toContain("Boutique Amel Paris");
    expect(res.result?.content[0].text).toContain("solara.post.create");
  });

  it("enforces agent rate limits via MCPRateLimiter", async () => {
    const config = { agentId: "agent-001", toolName: "identity_user_lookup", maxCalls: 2, windowMs: 1000 };

    expect(await rateLimiter.isAllowed(config)).toBe(true);
    expect(await rateLimiter.isAllowed(config)).toBe(true);
    expect(await rateLimiter.isAllowed(config)).toBe(false);
  });
});
