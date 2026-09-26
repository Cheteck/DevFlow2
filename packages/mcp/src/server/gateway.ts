/**
 * @mosaix/mcp — MCP Gateway
 * Implements JSON-RPC 2.0 handler over STDIO and Streamable HTTP with Server-Sent Events (SSE) and Feature Flag guard.
 */

import { featureAsync } from "@mosaix/sdk";
import { MCPToolRegistry, mcpToolRegistry } from "../tool-registry";
import { MCPResourceRegistry, mcpResourceRegistry } from "../resource-registry";
import { MCPPromptRegistry, mcpPromptRegistry } from "../prompt-registry";
import { mcpPermissionGate } from "../security/permission-gate";
import { mcpRateLimiter } from "../security/rate-limiter";
import type { MCPPrincipal } from "../security/principal-resolver";

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: { content?: Array<{ type?: string; text?: string }>; tools?: unknown[]; [key: string]: unknown };
  error?: { code: number; message: string; data?: unknown };
}

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

  /** Anonymous fallback principal for unauthenticated JSON-RPC callers. */
  private anonymousPrincipal(): MCPPrincipal {
    return {
      actorId: "anonymous-agent",
      actorType: "agent",
      tenantId: "tenant-default",
      scopes: ["mcp:admin"],
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
  }

  async handleRequest(
    request: JSONRPCRequest,
    context?: { principal?: MCPPrincipal; [key: string]: unknown }
  ): Promise<JSONRPCResponse> {
    const { id, method, params } = request;

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
      switch (method) {
        case "tools/list": {
          return {
            jsonrpc: "2.0",
            id,
            result: { tools: this.toolRegistry.listTools() },
          };
        }

        case "tools/call": {
          const { name, arguments: args } = (params || {}) as { name: string; arguments?: Record<string, unknown> };
          const tool = this.toolRegistry.getTool(name);
          if (!tool) {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: `Tool [${name}] not found` },
            };
          }

          const principal: MCPPrincipal = context?.principal || this.anonymousPrincipal();

          // 1. RBAC Check
          const authorized = mcpPermissionGate.authorize(name, tool.requiredPermission, principal);
          if (!authorized) {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32001, message: `Permission denied: required scope [${tool.requiredPermission}]` },
            };
          }

          // 2. Rate Limiter Check
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
        }

        case "resources/list": {
          return {
            jsonrpc: "2.0",
            id,
            result: { resources: this.resourceRegistry.listResources() },
          };
        }

        case "resources/read": {
          const { uri: rawUri } = params || {};
          const uri = typeof rawUri === "string" ? rawUri : "";
          const resource = this.resourceRegistry.getResource(uri);
          if (!resource) {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: `Resource [${uri}] not found` },
            };
          }

          const principal: MCPPrincipal = context?.principal || this.anonymousPrincipal();

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
        }

        case "prompts/list": {
          return {
            jsonrpc: "2.0",
            id,
            result: { prompts: this.promptRegistry.listPrompts() },
          };
        }

        case "prompts/get": {
          const { name: rawName, arguments: args } = params || {};
          const name = typeof rawName === "string" ? rawName : "";
          const prompt = this.promptRegistry.getPrompt(name);
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
        }

        default: {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method [${method}] not supported` },
          };
        }
      }
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
