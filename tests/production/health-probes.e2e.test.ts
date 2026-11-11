/**
 * @tests/production/health-probes.e2e.test.ts — P0-2 / R05
 * Verifies live, ready, and startup health probes under various infrastructure conditions.
 */
import { describe, expect, it } from "vitest";
import type * as http from "node:http";
import { URL } from "node:url";
import { dispatchApiRequest } from "../../src/server/api-dispatcher.js";
import type { DatabasePort } from "@mosaix/ports-database";
import type { ApiDispatcherContext } from "../../src/server/api-dispatcher.js";

function createMockDb(shouldFail = false): DatabasePort {
  return {
    async query<T = unknown>(): Promise<T[]> {
      if (shouldFail) throw new Error("Database connection error");
      return [{ health_check: 1 }] as unknown as T[];
    },
    async execute(): Promise<{ rowsAffected: number }> {
      if (shouldFail) throw new Error("Database connection error");
      return { rowsAffected: 1 };
    },
    async transaction<T>(fn: (tx: DatabasePort) => Promise<T>): Promise<T> {
      return fn(this);
    },
    async close(): Promise<void> {},
  };
}

function createMockContext(db: DatabasePort): ApiDispatcherContext {
  return {
    db,
  } as unknown as ApiDispatcherContext;
}

function createMockRes() {
  let statusCode = 0;
  let headers = {};
  let body = "";

  return {
    writeHead(code, h) {
      statusCode = code;
      headers = h || {};
    },
    end(data) {
      body = data || "";
    },
    getStatusCode() { return statusCode; },
    getHeaders() { return headers; },
    getBody() { return body; },
  };
}

describe("Health Probes (P0-2 / R05)", () => {
  it("GET /health/live returns 200 with alive status", async () => {
    const res = createMockRes();
    const parsedUrl = new URL("http://localhost/health/live");
    const ctx = createMockContext(createMockDb(false));
    await dispatchApiRequest({} as http.IncomingMessage, res, parsedUrl, ctx);
    expect(res.getStatusCode()).toBe(200);
    const data = JSON.parse(res.getBody());
    expect(data.status).toBe("alive");
    expect(data.timestamp).toBeDefined();
  });

  it("GET /health/ready returns 200 when database is healthy", async () => {
    const res = createMockRes();
    const parsedUrl = new URL("http://localhost/health/ready");
    const ctx = createMockContext(createMockDb(false));
    await dispatchApiRequest({} as http.IncomingMessage, res, parsedUrl, ctx);
    expect(res.getStatusCode()).toBe(200);
    const data = JSON.parse(res.getBody());
    expect(data.status).toBe("healthy");
    expect(data.services.database.status).toBe("up");
    expect(data.services.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("GET /health/ready returns 503 when database is failing", async () => {
    const res = createMockRes();
    const parsedUrl = new URL("http://localhost/health/ready");
    const ctx = createMockContext(createMockDb(true));
    await dispatchApiRequest({} as http.IncomingMessage, res, parsedUrl, ctx);
    expect(res.getStatusCode()).toBe(503);
    const data = JSON.parse(res.getBody());
    expect(data.status).toBe("unhealthy");
    expect(data.services.database.status).toBe("down");
  });

  it("GET /health/startup returns 200 with healthy status", async () => {
    const res = createMockRes();
    const parsedUrl = new URL("http://localhost/health/startup");
    const ctx = createMockContext(createMockDb(false));
    await dispatchApiRequest({} as http.IncomingMessage, res, parsedUrl, ctx);
    expect(res.getStatusCode()).toBe(200);
    const data = JSON.parse(res.getBody());
    expect(data.status).toBe("healthy");
  });
});
