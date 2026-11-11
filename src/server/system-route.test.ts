import { describe, it, expect, vi } from "vitest";
import type * as http from "node:http";
import { systemRouteRegistry, dispatchApiRequest } from "./api-dispatcher.js";

describe("systemRouteRegistry (OCP)", () => {
  it("dispatches a registered system handler", async () => {
    const handler = vi.fn(async () => true);
    systemRouteRegistry.register((p) => p === "/__test_system", handler);
    const req = {} as http.IncomingMessage;
    const res = {
      writeHead: () => {},
      end: () => {},
    } as unknown as http.ServerResponse;
    const parsedUrl = new URL("http://localhost/__test_system");
    const ctx = {} as unknown;
    const result = await dispatchApiRequest(req, res, parsedUrl, ctx);
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalled();
  });
});
