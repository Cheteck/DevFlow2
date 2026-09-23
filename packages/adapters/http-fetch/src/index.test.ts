import { describe, expect, it, vi, afterEach } from "vitest";
import { FetchHttpAdapter } from "./index";

describe("FetchHttpAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles GET and POST and parses JSON correctly", async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return {
            status: 201,
            statusText: "Created",
            headers: new Headers({ "content-type": "application/json" }),
            text: async () => JSON.stringify({ ok: true, body: init.body }),
          } as Response;
        }
        return {
          status: 200,
          statusText: "OK",
          headers: new Headers({ "content-type": "application/json" }),
          text: async () => JSON.stringify({ hello: "world" }),
        } as Response;
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = new FetchHttpAdapter();

    const getRes = await client.get("https://example.com/api");
    expect(getRes.status).toBe(200);
    expect(getRes.json()).toEqual({ hello: "world" });

    const postRes = await client.post("https://example.com/api", { data: 123 });
    expect(postRes.status).toBe(201);
    expect(postRes.json()).toEqual({
      ok: true,
      body: JSON.stringify({ data: 123 }),
    });
  });
});
