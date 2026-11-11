import { createTypedRegistry } from "@mosaix/support";
/**
 * @mosaix/mcp — MCP Gateway
 * Implements JSON-RPC 2.0 handler over STDIO and Streamable HTTP with Server-Sent Events (SSE) and Feature Flag guard.
 */

import { featureAsync } from "@mosaix/sdk";
import { CapabilityRegistry } from "@mosaix/intelligence";
import { MCPToolRegistry, mcpToolRegistry } from "../tool-registry.js";
import { MCPResourceRegistry, mcpResourceRegistry } from "../resource-registry.js";
import { MCPPromptRegistry, mcpPromptRegistry } from "../prompt-registry.js";
import { mcpPermissionGate } from "../security/permission-gate.js";
import { validateToolInput } from "../security/input-validator.js";
import { mcpRateLimiter } from "../security/rate-limiter.js";
import { MCPPrincipalResolver, type MCPPrincipal } from "../security/principal-resolver.js";

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: { content?: Array<{ type?: string; text?: string }>; tools?: unknown[]; [key: string]: unknown };
  error?: { code: number; message: string; data?: unknown };
}

/** MCP protocol versions this gateway negotiates (newest first). */
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

/** Call context passed to JSON-RPC dispatch: pre-resolved principal and/or raw auth header. */
export interface McpGatewayCallContext {
  principal?: MCPPrincipal;
  authHeader?: string;
  [key: string]: unknown;
}

export interface MCPGatewayContext {
  getToolRegistry(): MCPToolRegistry;
  getResourceRegistry(): MCPResourceRegistry;
  getPromptRegistry(): MCPPromptRegistry;
  resolvePrincipal(context?: McpGatewayCallContext): MCPPrincipal;
}

export type JsonRpcMethodHandler = (
  request: JSONRPCRequest,
  gateway: MCPGatewayContext,
  context?: McpGatewayCallContext,
) => Promise<JSONRPCResponse | null> | JSONRPCResponse | null;

const jsonRpcMethodRegistry = createTypedRegistry<string, JsonRpcMethodHandler>([], { name: "JsonRpcMethodRegistry" });

export function registerJsonRpcMethodHandler(method: string, handler: JsonRpcMethodHandler): void {
  jsonRpcMethodRegistry.register(method, handler);
}

export function overrideJsonRpcMethodHandler(method: string, handler: JsonRpcMethodHandler): void {
  jsonRpcMethodRegistry.override(method, handler);
}

// Built-in JSON-RPC handlers
registerJsonRpcMethodHandler("initialize", (request) => {
  const id = request.id ?? null;
  const rawParams = (request.params ?? {}) as { protocolVersion?: unknown };
  const requested = typeof rawParams.protocolVersion === "string" ? rawParams.protocolVersion : "";
  const negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : SUPPORTED_PROTOCOL_VERSIONS[0];
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: negotiated,
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
      },
      serverInfo: { name: "mosaix-mcp", version: "0.1.0" },
    },
  };
});

registerJsonRpcMethodHandler("notifications/initialized", () => null);

registerJsonRpcMethodHandler("ping", (request) => ({
  jsonrpc: "2.0",
  id: request.id ?? null,
  result: {},
}));

registerJsonRpcMethodHandler("tools/list", (request, gateway) => {
  const registeredTools = gateway.getToolRegistry().listTools();
  const intelligenceCaps = CapabilityRegistry.getInstance().list();
  const capabilityTools = intelligenceCaps.map((cap) => ({
    name: `intelligence_${cap.name.replace(/\./g, "_")}`,
    description: cap.description,
    inputSchema: (cap as unknown as Record<string, unknown>).inputSchema || { type: "object", properties: {} },
    requiredPermission: `intelligence:${cap.category}:execute`,
  }));

  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    result: { tools: [...registeredTools, ...capabilityTools] },
  };
});

registerJsonRpcMethodHandler("tools/call", async (request, gateway, context) => {
  const id = request.id ?? null;
  const { name, arguments: args } = (request.params || {}) as { name: string; arguments?: Record<string, unknown> };
  const tool = gateway.getToolRegistry().getTool(name);
  if (!tool) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Tool [${name}] not found` },
    };
  }

  const principal = gateway.resolvePrincipal(context);

  const violations = validateToolInput(tool.inputSchema, args);
  if (violations.length > 0) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32602,
        message: `Invalid params for tool [${name}]: ${violations
          .map((v) => (v.path ? `${v.path} ${v.message}` : v.message))
          .join("; ")}`,
      },
    };
  }

  const authorized = mcpPermissionGate.authorize(name, tool.requiredPermission, principal);
  if (!authorized) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32001, message: `Permission denied: required scope [${tool.requiredPermission}]` },
    };
  }

  const allowed = await mcpRateLimiter.isAllowed({
    agentId: principal.actorId,
    toolName: name,
    maxCalls: 100,
    windowMs: 60000,
  });
  if (!allowed) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32029, message: `Rate limit exceeded for tool [${name}]` },
    };
  }

  const res = await tool.handler(args, context);
  return {
    jsonrpc: "2.0",
    id,
    result: { content: [{ type: "text", text: typeof res === "string" ? res : JSON.stringify(res, null, 2) }] },
  };
});

registerJsonRpcMethodHandler("resources/list", (request, gateway) => ({
  jsonrpc: "2.0",
  id: request.id ?? null,
  result: { resources: gateway.getResourceRegistry().listResources() },
}));

registerJsonRpcMethodHandler("resources/read", async (request, gateway, context) => {
  const id = request.id ?? null;
  const { uri: rawUri } = request.params || {};
  const uri = typeof rawUri === "string" ? rawUri : "";
  const resource = gateway.getResourceRegistry().getResource(uri);
  if (!resource) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Resource [${uri}] not found` },
    };
  }

  const principal = gateway.resolvePrincipal(context);

  if (resource.requiredPermission) {
    const authorized = mcpPermissionGate.authorize(uri, resource.requiredPermission, principal);
    if (!authorized) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message: `Permission denied: required scope [${resource.requiredPermission}]` },
      };
    }
  }

  const contents = await resource.resolver(uri);
  return {
    jsonrpc: "2.0",
    id,
    result: { contents: [{ uri, mimeType: resource.mimeType || "application/json", text: JSON.stringify(contents, null, 2) }] },
  };
});

registerJsonRpcMethodHandler("prompts/list", (request, gateway) => ({
  jsonrpc: "2.0",
  id: request.id ?? null,
  result: { prompts: gateway.getPromptRegistry().listPrompts() },
}));

registerJsonRpcMethodHandler("prompts/get", async (request, gateway) => {
  const id = request.id ?? null;
  const { name: rawName, arguments: args } = request.params || {};
  const name = typeof rawName === "string" ? rawName : "";
  const prompt = gateway.getPromptRegistry().getPrompt(name);
  if (!prompt) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Prompt [${name}] not found` },
    };
  }
  const stringArgs: Record<string, string> = Object.fromEntries(
    Object.entries(args ?? {}).map(([key, value]) => [key, String(value ?? "")]),
  );
  const messages = await prompt.handler(stringArgs);
  return {
    jsonrpc: "2.0",
    id,
    result: { messages },
  };
});

export class MCPGateway {
  private toolRegistry: MCPToolRegistry;
  private resourceRegistry: MCPResourceRegistry;
  private promptRegistry: MCPPromptRegistry;

  constructor(
    tools = mcpToolRegistry,
    resources = mcpResourceRegistry,
    prompts = mcpPromptRegistry
  ) {
    this.toolRegistry = tools;
    this.resourceRegistry = resources;
    this.promptRegistry = prompts;
  }

  public getToolRegistry(): MCPToolRegistry {
    return this.toolRegistry;
  }

  public getResourceRegistry(): MCPResourceRegistry {
    return this.resourceRegistry;
  }

  public getPromptRegistry(): MCPPromptRegistry {
    return this.promptRegistry;
  }

  /**
   * Fallback principal for callers without credentials (MCP-03).
   * Deny-by-default: read-only scope, never `mcp:admin`. Any `tools/call`
   * without an authorized scope is rejected with -32001.
   */
  private anonymousPrincipal(): MCPPrincipal {
    return MCPPrincipalResolver.resolveFromHeader(undefined);
  }

  public resolvePrincipal(context?: McpGatewayCallContext): MCPPrincipal {
    if (context?.principal) return context.principal;
    if (typeof context?.authHeader === "string") {
      return MCPPrincipalResolver.resolveFromHeader(context.authHeader);
    }
    return this.anonymousPrincipal();
  }

  async handleRequest(
    request: JSONRPCRequest,
    context?: McpGatewayCallContext,
  ): Promise<JSONRPCResponse | null> {
    const { id: rawId, method } = request;
    const id = rawId ?? null;

    // P0 Feature Flag Guard: platform.mcp.gateway_enabled (default: true)
    const gatewayEnabled = await featureAsync("platform.mcp.gateway_enabled", true);
    if (!gatewayEnabled) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: "MCP Gateway is currently disabled by platform feature flag [platform.mcp.gateway_enabled]." },
      };
    }

    try {
      const handler = jsonRpcMethodRegistry.get(method);
      if (handler) {
        return await handler(request, this, context);
      }

      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method [${method}] not supported` },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  /**
   * Formats a JSON-RPC response as a Server-Sent Event (SSE) message payload.
   */
  formatSSEMessage(response: JSONRPCResponse): string {
    return `event: message\ndata: ${JSON.stringify(response)}\n\n`;
  }
}
