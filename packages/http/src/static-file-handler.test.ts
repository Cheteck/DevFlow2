import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { serveStaticFile, getMimeType, generateETag } from "./static-file-handler.js";

describe("Static File Handler (@mosaix/http)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mosaix-static-test-"));
    // Create test files
    await fs.promises.writeFile(path.join(tmpDir, "favicon.svg"), "<svg>favicon</svg>", "utf-8");
    await fs.promises.writeFile(path.join(tmpDir, "logo.png"), "fake-png-binary", "utf-8");
    await fs.promises.writeFile(path.join(tmpDir, "site.webmanifest"), '{"name":"MosaiX"}', "utf-8");
    await fs.promises.writeFile(path.join(tmpDir, "index.html"), "<h1>Home</h1>", "utf-8");
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("should return correct MIME types for standard files", () => {
    expect(getMimeType("favicon.svg")).toBe("image/svg+xml");
    expect(getMimeType("logo.png")).toBe("image/png");
    expect(getMimeType("site.webmanifest")).toBe("application/manifest+json; charset=utf-8");
    expect(getMimeType("styles.css")).toBe("text/css; charset=utf-8");
    expect(getMimeType("app.js")).toBe("application/javascript; charset=utf-8");
    expect(getMimeType("unknown.xyz")).toBe("application/octet-stream");
  });

  it("should generate deterministic ETag from fs.Stats", async () => {
    const stat = await fs.promises.stat(path.join(tmpDir, "favicon.svg"));
    const etag = generateETag(stat);
    expect(etag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
  });

  it("should serve an existing file with 200 and accurate headers", async () => {
    const server = http.createServer(async (req, res) => {
      const handled = await serveStaticFile(req, res, { root: tmpDir });
      if (!handled) {
        res.writeHead(404);
        res.end("Not handled");
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await fetch(`http://localhost:${port}/favicon.svg`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("etag")).toBeDefined();
    expect(response.headers.get("cache-control")).toContain("public");

    const text = await response.text();
    expect(text).toBe("<svg>favicon</svg>");

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("should return 304 Not Modified when client sends matching If-None-Match", async () => {
    const server = http.createServer(async (req, res) => {
      await serveStaticFile(req, res, { root: tmpDir });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const firstRes = await fetch(`http://localhost:${port}/favicon.svg`);
    const etag = firstRes.headers.get("etag")!;
    expect(etag).toBeDefined();

    const secondRes = await fetch(`http://localhost:${port}/favicon.svg`, {
      headers: { "if-none-match": etag },
    });
    expect(secondRes.status).toBe(304);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("should block path traversal attempts securely", async () => {
    const server = http.createServer(async (req, res) => {
      const handled = await serveStaticFile(req, res, { root: tmpDir, fallthrough: false });
      if (!handled) {
        res.writeHead(404);
        res.end("Not handled");
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const res = await fetch(`http://localhost:${port}/../../../etc/passwd`);
    // Path traversal is normalized and rejected or returns 403 / 404
    expect([403, 404]).toContain(res.status);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("should fall through gracefully on missing files when fallthrough=true", async () => {
    let fallthroughReached = false;
    const server = http.createServer(async (req, res) => {
      const handled = await serveStaticFile(req, res, { root: tmpDir, fallthrough: true });
      if (!handled) {
        fallthroughReached = true;
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Fallback route reached");
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    const response = await fetch(`http://localhost:${port}/non-existent-asset.png`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe("Fallback route reached");
    expect(fallthroughReached).toBe(true);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
