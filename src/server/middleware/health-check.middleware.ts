/**
 * @server/middleware — Health Check Middleware
 * Provides health check endpoints for monitoring and readiness probes.
 * Exposes /health and /metrics endpoints compatible with Prometheus.
 */

import type * as http from "node:http";

/** Request handler signature compatible with node:http Server. */
export type HandlerFunction = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void;

/** Express/Connect-style next callback. */
export type NextFunction = (err?: unknown) => void;

export interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  services?: Record<string, boolean>;
}

export interface HealthCheckOptions {
  includeServices?: boolean;
  version?: string;
}

export function createHealthCheckEndpoint(
  options: HealthCheckOptions = {}
): HandlerFunction {
  const version = options.version || "1.0.0";

  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = req.url as string;

    if (url === "/health" || url === "/healthz") {
      handleHealthCheck(res, "healthy", version);
    } else if (url === "/metrics") {
      handleMetricsEndpoint(res, version);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  };
}

function handleHealthCheck(
  res: http.ServerResponse,
  status: "healthy" | "degraded" | "unhealthy",
  version: string
) {
  const health: HealthCheck = {
    status,
    timestamp: new Date().toISOString(),
    version,
  };

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store",
  });
  res.end(JSON.stringify(health));
}

function handleMetricsEndpoint(res: http.ServerResponse, version: string) {
  const metrics = `# HELP mosaic_health_status Health check status (1=healthy, 0=unhealthy)\n# TYPE mosaic_health_status gauge\nmosaic_health_status 1\n# HELP mosaic_version Version information\n# TYPE mosaic_version gauge\nmosaic_version ${parseFloat(version)}\n`;

  res.writeHead(200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    "Cache-Control": "no-cache, no-store",
  });
  res.end(metrics);
}

/**
 * Quick health check responder for router middleware
 * Usage: app.use('/health', createHealthCheckEndpoint())
 */
export function healthCheckMiddleware(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  next: NextFunction
): void {
  const url = req.url as string;

  if (url === "/health" || url === "/healthz") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store",
    });
    res.end(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }));
    return;
  }

  if (url === "/metrics") {
    res.writeHead(200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
    res.end(
      `# MosaiX Metrics\n# Generated: ${new Date().toISOString()}\n`
    );
    return;
  }

  next();
}