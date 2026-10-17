import { describe, it, expect } from "vitest";
import {
  MCPGateway,
  registerJsonRpcMethodHandler,
} from "../packages/mcp/src/server/gateway.js";

describe("MCP Gateway JSON-RPC Method OCP Extension", () => {
  it("allows registering custom JSON-RPC method handlers without modifying handleRequest switch", async () => {
    registerJsonRpcMethodHandler("completion/complete", async (request) => {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          completion: {
            values: ["mosaix-platform"],
          },
        },
      };
    });

    const gateway = new MCPGateway();
    const res = await gateway.handleRequest({
      jsonrpc: "2.0",
      id: 42,
      method: "completion/complete",
    });

    expect(res).not.toBeNull();
    expect(res?.id).toBe(42);
    expect(res?.result?.completion).toBeDefined();
  });
});
