import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { handleMcpRoutes } from "./mcp-routes.js";

function fakeReq(method: string, url: string, body?: string, headers: Record<string, string> = {}): IncomingMessage {
  const stream = new Readable({
    read() {
      if (body !== undefined) {
        this.push(body);
      }
      this.push(null);
    },
  });
  return Object.assign(stream, {
    method,
    url,
    headers: { host: "localhost:3000", ...headers },
  }) as unknown as IncomingMessage;
}

function fakeRes(): { res: ServerResponse; output: { statusCode: number; body: string } } {
  const output = { statusCode: 0, body: "" };
  const res = {
    writeHead: (statusCode: number) => {
      output.statusCode = statusCode;
    },
    end: (chunk?: unknown) => {
      output.body = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
    },
  } as unknown as ServerResponse;
  return { res, output };
}

describe("MCP over Streamable HTTP (remote config)", () => {
  it("ignores non-MCP paths", async () => {
    const { res } = fakeRes();
    const handled = await handleMcpRoutes(
      fakeReq("GET", "/api/other"),
      res,
      new URL("http://localhost/api/other"),
    );
    expect(handled).toBe(false);
  });

  it("answers GET with server info", async () => {
    const { res, output } = fakeRes();
    const handled = await handleMcpRoutes(
      fakeReq("GET", "/api/mcp"),
      res,
      new URL("http://localhost/api/mcp"),
    );
    expect(handled).toBe(true);
    expect(output.statusCode).toBe(200);
    expect(output.body).toContain("mosaix-mcp");
  });

  it("handles initialize over POST", async () => {
    const { res, output } = fakeRes();
    const handled = await handleMcpRoutes(
      fakeReq(
        "POST",
        "/api/mcp",
        JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: { protocolVersion: "2024-11-05", capabilities: {} },
        }),
      ),
      res,
      new URL("http://localhost/api/mcp"),
    );
    expect(handled).toBe(true);
    expect(output.statusCode).toBe(200);
    const parsed = JSON.parse(output.body) as { result: { protocolVersion: string } };
    expect(parsed.result.protocolVersion).toBe("2024-11-05");
  });

  it("denies anonymous tools/call over HTTP (MCP-03)", async () => {
    const { res, output } = fakeRes();
    await handleMcpRoutes(
      fakeReq(
        "POST",
        "/api/mcp",
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "portfolio_listing_quality_score", arguments: { reference: "R", title: "T" } },
        }),
      ),
      res,
      new URL("http://localhost/api/mcp"),
    );
    expect(output.statusCode).toBe(200);
    const parsed = JSON.parse(output.body) as { error: { code: number } };
    expect(parsed.error.code).toBe(-32001);
  });
});
