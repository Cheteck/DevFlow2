/**
 * @mosaix/mcp — MCP Gateway
 * Implements JSON-RPC 2.0 handler over STDIO and Streamable HTTP with Server-Sent Events (SSE) and Feature Flag guard.
 */

import { featureAsync } from "@mosaix/sdk";
import { CapabilityRegistry } from "@mosaix/intelligence";
import { MCPToolRegistry, mcpToolRegistry } from "../tool-registry";
import { MCPResourceRegistry, mcpResourceRegistry } from "../resource-registry";
import { MCPPromptRegistry, mcpPromptRegistry } from "../prompt-registry";
import { mcpPermissionGate } from "../security/permission-gate";
import { validateToolInput } from "../security/input-validator";
import { mcpRateLimiter } from "../security/rate-limiter";
import { MCPPrincipalResolver, type MCPPrincipal } from "../security/principal-resolver";

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

  /**
   * Fallback principal for callers without credentials (MCP-03).
   * Deny-by-default: read-only scope, never `mcp:admin`. Any `tools/call`
   * without an authorized scope is rejected with -32001.
   */
  private anonymousPrincipal(): MCPPrincipal {
    return MCPPrincipalResolver.resolveFromHeader(undefined);
  }

  private resolvePrincipal(context?: {
    principal?: MCPPrincipal;
    authHeader?: string;
    [key: string]: unknown;
  }): MCPPrincipal {
    if (context?.principal) return context.principal;
    if (typeof context?.authHeader === "string") {
      return MCPPrincipalResolver.resolveFromHeader(context.authHeader);
    }
    return this.anonymousPrincipal();
  }

  async handleRequest(
    request: JSONRPCRequest,
    context?: { principal?: MCPPrincipal; authHeader?: string; [key: string]: unknown },
  ): Promise<JSONRPCResponse | null> {
    const { id: rawId, method, params } = request;
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
      switch (method) {
        case "initialize": {
          // MCP lifecycle handshake (required by clients like OpenCode).
          const rawParams = (params ?? {}) as { protocolVersion?: unknown };
          const requested =
            typeof rawParams.protocolVersion === "string" ? rawParams.protocolVersion : "";
          const negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : SUPPORTED_PROTOCOL_VERSIONS[0];
          return {
            jsonrpc: "2.0",
            id: id ?? null,
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
        }

        case "notifications/initialized": {
          // JSON-RPC notification: no response expected on stdio.
          return null;
        }

        case "ping": {
          return { jsonrpc: "2.0", id: id ?? null, result: {} };
        }

        case "tools/list": {
          // Dynamically surface registered tools from MCPToolRegistry AND CapabilityRegistry (INT-MCP-02)
          const registeredTools = this.toolRegistry.listTools();
          const intelligenceCaps = CapabilityRegistry.getInstance().list();
          const capabilityTools = intelligenceCaps.map((cap) => ({
            name: `intelligence_${cap.name.replace(/\./g, "_")}`,
            description: cap.description,
            /* AUDIT-RESET a055b8e (2026-10-13) — AUCUNE PERTE DÉTECTÉE.
             * Fallback inputSchema {} quand la capability n'en expose pas (évite undefined dans tools/list) :
             * seul changement de comportement, conforme au "build 0 erreur". Fait partie du batch "and 14 more".
             * Tester tools/list avec capabilities sans schéma après toute restauration. */
            inputSchema: (cap as unknown as Record<string, unknown>).inputSchema || { type: "object", properties: {} },
            requiredPermission: `intelligence:${cap.category}:execute`,
          }));

          return {
            jsonrpc: "2.0",
            id,
            result: { tools: [...registeredTools, ...capabilityTools] },
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

          const principal: MCPPrincipal = this.resolvePrincipal(context);

          // 0. Input validation against the tool schema (MCP-04)
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

          const principal: MCPPrincipal = this.resolvePrincipal(context);

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
