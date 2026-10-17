/**
 * /metrics exposition tests: Prometheus format, labels, handler contract.
 */

import { describe, it, expect } from "vitest";
import {
  handleMetricsRoute,
  renderPrometheusMetrics,
  PLATFORM_VERSION,
} from "./metrics-route.js";

describe("renderPrometheusMetrics", () => {
  it("emits HELP/TYPE headers and three gauges with a version label", () => {
    const out = renderPrometheusMetrics(123.456, 987654321);
    expect(out.endsWith("\n")).toBe(true);
    expect(out).toContain("# HELP mosaix_info");
    expect(out).toContain("# TYPE mosaix_info gauge");
    expect(out).toContain(`mosaix_info{version="${PLATFORM_VERSION}"} 1`);
    expect(out).toContain("mosaix_process_uptime_seconds 123.456");
    expect(out).toContain("mosaix_process_memory_rss_bytes 987654321");
  });

  it("escapes hostile label values and degrades non-finite numbers", () => {
    const out = renderPrometheusMetrics(Number.NaN, -1, 'a"b\\c\nd');
    expect(out).toContain('mosaix_info{version="a\\"b\\\\c\\nd"} 1');
    expect(out).toContain("mosaix_process_uptime_seconds NaN");
  });
});

describe("handleMetricsRoute", () => {
  function mockRes(): {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
    res: {
      writeHead: (status: number, headers: Record<string, string>) => void;
      end: (body: string) => void;
    };
  } {
    const mocked: {
      status?: number;
      headers?: Record<string, string>;
      body?: string;
      res: {
        writeHead: (status: number, headers: Record<string, string>) => void;
        end: (body: string) => void;
      };
    } = {
      res: {
        writeHead: (status, headers) => {
          mocked.status = status;
          mocked.headers = headers;
        },
        end: (body) => {
          mocked.body = body;
        },
      },
    };
    return mocked;
  }

  it("serves exposition format on GET /metrics", async () => {
    const mocked = mockRes();
    const handled = await handleMetricsRoute(
      { method: "GET" } as never,
      mocked.res as never,
      new URL("http://localhost:3000/metrics"),
    );
    expect(handled).toBe(true);
    expect(mocked).toMatchObject({ status: 200 });
    expect(mocked.headers?.["Content-Type"]).toContain(
      "text/plain; version=0.0.4",
    );
    expect(mocked.body ?? "").toContain("mosaix_process_uptime_seconds");
  });

  it("ignores other paths and rejects non-GET", async () => {
    const other = mockRes();
    expect(
      await handleMetricsRoute(
        { method: "GET" } as never,
        other.res as never,
        new URL("http://localhost:3000/healthz"),
      ),
    ).toBe(false);

    const post = mockRes();
    expect(
      await handleMetricsRoute(
        { method: "POST" } as never,
        post.res as never,
        new URL("http://localhost:3000/metrics"),
      ),
    ).toBe(true);
    expect(post).toMatchObject({ status: 405 });
  });
});
