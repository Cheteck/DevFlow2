/**
 * @server/routes — Minimal Prometheus exposition endpoint (OBS-METRICS-01).
 *
 * `GET /metrics` → `text/plain; version=0.0.4`, no auth (scrapers cannot log
 * in) and deliberately NO database coupling: the endpoint must stay up when
 * the database is down (that is when operators need it most). Process-only
 * gauges for now; app gauges (ledger size, BAC counts) only once they can be
 * served from cheap synchronous reads.
 */

import type * as http from "node:http";
import type { URL } from "node:url";

/** Mirrors the root `package.json` version and the `/__mosaix` payload. */
export const PLATFORM_VERSION = "0.1.0";

function escapeLabelValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function formatMetricValue(value: number): string {
  return Number.isFinite(value) ? String(value) : "NaN";
}

/** Pure renderer (unit-tested): Prometheus text exposition format. */
export function renderPrometheusMetrics(
  uptimeSeconds: number,
  memoryRssBytes: number,
  version: string = PLATFORM_VERSION,
): string {
  const lines = [
    "# HELP mosaix_info Static platform build info.",
    "# TYPE mosaix_info gauge",
    `mosaix_info{version="${escapeLabelValue(version)}"} 1`,
    "# HELP mosaix_process_uptime_seconds Process uptime in seconds.",
    "# TYPE mosaix_process_uptime_seconds gauge",
    `mosaix_process_uptime_seconds ${formatMetricValue(uptimeSeconds)}`,
    "# HELP mosaix_process_memory_rss_bytes Process resident set size in bytes.",
    "# TYPE mosaix_process_memory_rss_bytes gauge",
    `mosaix_process_memory_rss_bytes ${formatMetricValue(Math.round(memoryRssBytes))}`,
  ];
  return `${lines.join("\n")}\n`;
}

export async function handleMetricsRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
): Promise<boolean> {
  if (parsedUrl.pathname !== "/metrics") return false;
  if (req.method !== undefined && req.method !== "GET") {
    res.writeHead(405, {
      "Content-Type": "text/plain; charset=utf-8",
      Allow: "GET",
    });
    res.end("Method Not Allowed\n");
    return true;
  }
  res.writeHead(200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(renderPrometheusMetrics(process.uptime(), process.memoryUsage().rss));
  return true;
}
