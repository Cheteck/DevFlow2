/**
 * src/server/routes/mcp-routes.ts — MosaiX MCP over Streamable HTTP.
 *
 * Exposes the `@mosaix/mcp` gateway at `POST /api/mcp` (single-shot
 * JSON-RPC, no SSE streaming) so remote MCP clients (OpenCode, IDEs)
 * can consume the same tools as the stdio server.
 *
 * Auth: the `Authorization` header is forwarded to the gateway, which
 * resolves the principal via `MCPPrincipalResolver`. No header means
 * the deny-by-default anonymous principal (MCP-03).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  AppToolProvider,
  IntelligenceToolProvider,
  MCPPromptRegistry,
  MCPResourceRegistry,
  MCPGateway,
  MCPToolRegistry,
  PlatformToolProvider,
  WorkflowToolProvider,
  createPortfolioBACClient,
  registerPortfolioPrompts,
  registerPortfolioResources,
  registerPortfolioTools,
  type PortfolioBACClient,
  type PortfolioModuleLike,
} from "@mosaix/mcp";

import type { DatabasePort } from "@mosaix/ports-database";

let gatewayPromise: Promise<MCPGateway> | null = null;
let gatewayPersistent = false;

/**
 * Builds the Portfolio BAC client. When the server hands over its Postgres
 * DatabasePort, the client persists through `PostgresVendableRepository`
 * (`portfolio.vendables`) so MCP imports survive restarts. Otherwise it falls
 * back to the ephemeral InMemory repository (stdio parity) and logs it.
 */
async function wirePortfolioClient(
  db?: DatabasePort,
): Promise<PortfolioBACClient | undefined> {
  const candidates = [
    "@apps/portfolio",
    new URL("../../../apps/portfolio/src/index.ts", import.meta.url).href,
  ];
  for (const specifier of candidates) {
    try {
      // NOTE: never `as typeof portfolio` here — the self-referential query
      // freezes the narrowed type to `null` (see stdio-server wiring).
      const portfolio = (await import(specifier)) as PortfolioModuleLike;
      const PostgresRepo = portfolio.PostgresVendableRepository;
      const repository =
        db?.capabilities.dialect === "postgres" &&
        typeof PostgresRepo === "function"
          ? new PostgresRepo(db)
          // eslint-disable-next-line no-restricted-syntax -- repli documente quand le serveur ne fournit pas de DatabasePort Postgres (warn ci-dessous) ; le stdio reste le seul transport sans DB.
          : new portfolio.InMemoryVendableRepository();
      if (db?.capabilities.dialect !== "postgres") {
        console.warn(
          "[mcp-routes] portfolio MCP client on ephemeral InMemory store (no Postgres DatabasePort).",
        );
      }
      const service = new portfolio.PortfolioService(repository);
      return createPortfolioBACClient(service);
    } catch {
      continue;
    }
  }
  return undefined;
}

async function getGateway(db?: DatabasePort): Promise<MCPGateway> {
  const wantsPersistent = db?.capabilities.dialect === "postgres";
  if (!gatewayPromise || (wantsPersistent && !gatewayPersistent)) {
    gatewayPersistent = wantsPersistent;
    gatewayPromise = (async () => {
      const tools = new MCPToolRegistry();
      const resources = new MCPResourceRegistry();
      const prompts = new MCPPromptRegistry();
      PlatformToolProvider.register(tools, resources);
      AppToolProvider.register(tools);
      IntelligenceToolProvider.register(tools);
      WorkflowToolProvider.register(tools, prompts);
      const client = await wirePortfolioClient(db);
      registerPortfolioTools(tools, client);
      registerPortfolioResources(resources, client);
      registerPortfolioPrompts(prompts);
      return new MCPGateway(tools, resources, prompts);
    })();
  }
  return gatewayPromise;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

export async function handleMcpRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  parsedUrl: URL,
  db?: DatabasePort,
): Promise<boolean> {
  if (parsedUrl.pathname !== "/api/mcp") {
    return false;
  }

  if (req.method === "GET") {
    json(res, 200, {
      status: "ok",
      name: "mosaix-mcp",
      transports: ["streamable-http"],
      usage: "POST JSON-RPC 2.0 { jsonrpc, id, method, params }",
    });
    return true;
  }

  if (req.method !== "POST") {
    json(res, 405, {
      error: "Method not allowed, use POST with a JSON-RPC body.",
    });
    return true;
  }

  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    json(res, 400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: unreadable body" },
    });
    return true;
  }

  let message: unknown;
  try {
    message = raw ? JSON.parse(raw) : null;
  } catch {
    json(res, 200, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: invalid JSON" },
    });
    return true;
  }

  if (
    !message ||
    typeof message !== "object" ||
    typeof (message as { method?: unknown }).method !== "string"
  ) {
    json(res, 200, {
      jsonrpc: "2.0",
      id: (message as { id?: string | number | null } | null)?.id ?? null,
      error: { code: -32600, message: "Invalid Request" },
    });
    return true;
  }

  const gateway = await getGateway(db);
  const authHeader = req.headers["authorization"];
  const response = await gateway.handleRequest(
    message as {
      jsonrpc: "2.0";
      id?: string | number | null;
      method: string;
      params?: Record<string, unknown>;
    },
    typeof authHeader === "string" ? { authHeader } : undefined,
  );

  if (!response) {
    res.writeHead(202);
    res.end();
    return true;
  }
  json(res, 200, response);
  return true;
}
