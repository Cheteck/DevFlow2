import { describe, it, expect, beforeEach } from "vitest";
import { MCPToolRegistry } from "./tool-registry.js";
import { MCPResourceRegistry } from "./resource-registry.js";
import { MCPPromptRegistry } from "./prompt-registry.js";
import { MCPGateway } from "./server/gateway.js";
import { MCPPermissionGate } from "./security/permission-gate.js";
import { MCPAuditLogger } from "./security/audit-logger.js";
import { MCPRateLimiter } from "./security/rate-limiter.js";
import { PlatformToolProvider } from "./providers/platform.js";
import { AppToolProvider } from "./providers/app.js";
import { WorkflowToolProvider } from "./providers/workflows.js";
import { MCPPrincipalResolver } from "./security/principal-resolver.js";
import { JwtService } from "@mosaix/auth";

describe("MosaiX MCP Server Agent Interoperability Layer", () => {
  let tools: MCPToolRegistry;
  let resources: MCPResourceRegistry;
  let prompts: MCPPromptRegistry;
  let gateway: MCPGateway;
  let auditLogger: MCPAuditLogger;
  let _permissionGate: MCPPermissionGate;
  let rateLimiter: MCPRateLimiter;
  let testJwtService: JwtService;

  beforeEach(() => {
    tools = new MCPToolRegistry();
    resources = new MCPResourceRegistry();
    prompts = new MCPPromptRegistry();
    gateway = new MCPGateway(tools, resources, prompts);
    auditLogger = new MCPAuditLogger();
    _permissionGate = new MCPPermissionGate(auditLogger);
    rateLimiter = new MCPRateLimiter();

    testJwtService = new JwtService({
      secret: "mosaix-test-secret-key-1234567890",
    });
    MCPPrincipalResolver.setJwtService(testJwtService);
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

    const res = await gateway.handleRequest(
      {
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
      },
      {
        principal: {
          actorId: "agent-test-1",
          actorType: "agent",
          tenantId: "tenant-test",
          scopes: ["spaces:space:create"],
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      },
    );

    expect(res?.result?.content?.[0]?.text).toContain("Boutique Amel Paris");
    expect(res?.result?.content?.[0]?.text).toContain("solara.post.create");
  });

  it("enforces agent rate limits via MCPRateLimiter", async () => {
    const config = { agentId: "agent-001", toolName: "identity_user_lookup", maxCalls: 2, windowMs: 1000 };

    expect(await rateLimiter.isAllowed(config)).toBe(true);
    expect(await rateLimiter.isAllowed(config)).toBe(true);
    expect(await rateLimiter.isAllowed(config)).toBe(false);
  });

  it("denies anonymous tools/call by default (MCP-03, no mcp:admin bypass)", async () => {
    WorkflowToolProvider.register(tools, prompts);

    const res = await gateway.handleRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "mosaix_create_business_space",
        arguments: { spaceName: "X", ownerUserId: "u", announcementText: "hi" },
      },
    });

    expect(res?.error?.code).toBe(-32001);
    expect(res?.error?.message).toContain("spaces:space:create");
  });

  it("resolves valid principals from cryptographically signed auth headers via MCPPrincipalResolver (MCP-03c)", async () => {
    WorkflowToolProvider.register(tools, prompts);

    const validToken = testJwtService.sign({
      sub: "agent-legit-007",
      tenantId: "tenant-999",
      scopes: ["spaces:space:create"],
    });

    const res = await gateway.handleRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "mosaix_create_business_space",
          arguments: { spaceName: "Y", ownerUserId: "u", announcementText: "hi" },
        },
      },
      { authHeader: `Bearer ${validToken}` },
    );

    expect(res?.error).toBeUndefined();
    expect(res?.result?.content?.[0]?.text).toContain("Y");
  });

  it("denies privileged tool calls when auth header contains fake or expired Bearer token (MCP-03c)", async () => {
    WorkflowToolProvider.register(tools, prompts);

    // 1. Fake token with unmatching signature
    const fakeRes = await gateway.handleRequest(
      {
        jsonrpc: "2.0",
        id: 31,
        method: "tools/call",
        params: {
          name: "mosaix_create_business_space",
          arguments: { spaceName: "Z", ownerUserId: "u", announcementText: "hi" },
        },
      },
      { authHeader: "Bearer forged-token-value" },
    );

    expect(fakeRes?.error?.code).toBe(-32001);
    expect(fakeRes?.error?.message).toContain("Permission denied");

    // 2. Expired token signed with same secret
    const expiredToken = testJwtService.sign({
      sub: "agent-expired",
      tenantId: "tenant-999",
      scopes: ["spaces:space:create"],
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    });

    const expiredRes = await gateway.handleRequest(
      {
        jsonrpc: "2.0",
        id: 32,
        method: "tools/call",
        params: {
          name: "mosaix_create_business_space",
          arguments: { spaceName: "Z", ownerUserId: "u", announcementText: "hi" },
        },
      },
      { authHeader: `Bearer ${expiredToken}` },
    );

    expect(expiredRes?.error?.code).toBe(-32001);
    expect(expiredRes?.error?.message).toContain("Permission denied");
  });

  it("rejects invalid tool arguments before authorization (MCP-04)", async () => {
    AppToolProvider.register(tools);

    const res = await gateway.handleRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "imperia_create_bill", arguments: { title: "Only a title" } },
    });

    expect(res?.error?.code).toBe(-32602);
    expect(res?.error?.message).toContain("description");
  });

  it("negotiates the MCP lifecycle handshake (initialize)", async () => {
    const res = await gateway.handleRequest({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "opencode", version: "test" },
      },
    });

    const result = res?.result as {
      protocolVersion: string;
      capabilities: { tools: unknown; resources: unknown; prompts: unknown };
      serverInfo: { name: string };
    };
    expect(result.protocolVersion).toBe("2024-11-05");
    expect(result.capabilities.tools).toBeDefined();
    expect(result.serverInfo.name).toBe("mosaix-mcp");
  });

  it("falls back to the newest supported protocol version", async () => {
    const res = await gateway.handleRequest({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: { protocolVersion: "1999-01-01", capabilities: {} },
    });

    expect((res?.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
  });

  it("answers notifications/initialized with no response", async () => {
    const res = await gateway.handleRequest({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    expect(res).toBeNull();
  });
});
