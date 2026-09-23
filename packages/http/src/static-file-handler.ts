/**
 * @mosaix/http — High Performance & Secure Static File Handler
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type * as http from "node:http";

export interface StaticFileOptions {
  /** Root directory on the filesystem from which files are served. */
  root: string;
  /** Cache-Control max-age in seconds (default: 86400 / 24h). */
  maxAge?: number;
  /** Whether to append immutable to the Cache-Control header. */
  immutable?: boolean;
  /** If true, returns false without writing a 404 response when a file is not found. (Default: true) */
  fallthrough?: boolean;
  /** Default index file for directory requests (default: "index.html"). */
  index?: string | false;
}

const MIME_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Computes an HTTP ETag based on file size and mtime.
 */
export function generateETag(stat: fs.Stats): string {
  const mtime = Math.floor(stat.mtimeMs).toString(16);
  const size = stat.size.toString(16);
  return `W/"${size}-${mtime}"`;
}

/**
 * Safely serves a static file from a root directory to an HTTP response.
 *
 * @param req Incoming HTTP request
 * @param res Server HTTP response
 * @param options Static file options
 * @returns Promise<boolean> true if request was handled (200, 304, or error sent), false if file not found and fallthrough is enabled.
 */
export async function serveStaticFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: StaticFileOptions
): Promise<boolean> {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  const rootResolved = path.resolve(options.root);
  const rawUrl = req.url || "/";
  let pathname: string;
  try {
    const parsed = new URL(rawUrl, "http://localhost");
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    if (options.fallthrough !== false) return false;
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid URL" }));
    return true;
  }

  // Sanitize path against directory traversal
  const normalizedPath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const targetPath = path.resolve(rootResolved, `.${path.sep}${normalizedPath}`);

  // Security Check: Path Traversal prevention
  if (!targetPath.startsWith(rootResolved)) {
    if (options.fallthrough !== false) return false;
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Access denied" }));
    return true;
  }

  let finalPath = targetPath;
  let stat: fs.Stats;

  try {
    stat = await fs.promises.stat(finalPath);
    if (stat.isDirectory()) {
      const indexFile = options.index !== undefined ? options.index : "index.html";
      if (indexFile) {
        finalPath = path.join(finalPath, indexFile);
        stat = await fs.promises.stat(finalPath);
      } else {
        return false;
      }
    }
  } catch {
    // File not found
    if (options.fallthrough !== false) {
      return false;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "File not found" }));
    return true;
  }

  if (!stat.isFile()) {
    return false;
  }

  // ETag & Cache verification
  const etag = generateETag(stat);
  const maxAge = options.maxAge ?? 86400;
  const cacheControl = options.immutable
    ? `public, max-age=${maxAge}, immutable`
    : `public, max-age=${maxAge}`;

  const clientETag = req.headers["if-none-match"];
  if (clientETag && (clientETag === etag || clientETag === `W/${etag}`)) {
    res.writeHead(304, {
      "ETag": etag,
      "Cache-Control": cacheControl,
      "Last-Modified": stat.mtime.toUTCString(),
    });
    res.end();
    return true;
  }

  const clientIfModifiedSince = req.headers["if-modified-since"];
  if (clientIfModifiedSince) {
    const clientTime = new Date(clientIfModifiedSince).getTime();
    if (!isNaN(clientTime) && stat.mtimeMs <= clientTime + 1000) {
      res.writeHead(304, {
        "ETag": etag,
        "Cache-Control": cacheControl,
        "Last-Modified": stat.mtime.toUTCString(),
      });
      res.end();
      return true;
    }
  }

  const contentType = getMimeType(finalPath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "ETag": etag,
    "Last-Modified": stat.mtime.toUTCString(),
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  });

  if (method === "HEAD") {
    res.end();
    return true;
  }

  return new Promise<boolean>((resolve, reject) => {
    const stream = fs.createReadStream(finalPath);
    stream.on("error", (err) => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error reading file" }));
      }
      reject(err);
    });
    stream.on("end", () => {
      resolve(true);
    });
    stream.pipe(res);
  });
}
