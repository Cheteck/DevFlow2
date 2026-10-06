import type { IncomingMessage, ServerResponse } from "node:http";
import {
  HumanReviewQueue,
  IntelligenceMetricsCollector,
  IntelligenceRuntime,
  ProviderRouter,
} from "@mosaix/intelligence";
import { TypeSafeJevProvider } from "@mosaix/adapter-intelligence-typesafe";

const router = new ProviderRouter();
router.register(new TypeSafeJevProvider());
const runtime = new IntelligenceRuntime(router);

function jsonResponse(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export async function handleIntelligenceRoutes(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url || "/";
  const method = req.method || "GET";

  if (url === "/api/intelligence/decide" && method === "POST") {
    try {
      const body = await parseJsonBody<{
        capability: string;
        state: unknown;
        policy?: AIPolicy;
      }>(req);
      if (!body.capability) {
        jsonResponse(res, 400, { error: "Missing required capability field" });
        return true;
      }
      const decision = await runtime.decide({
        capability: body.capability,
        state: body.state,
        policy: body.policy,
      });
      jsonResponse(res, 200, { status: "success", data: decision });
    } catch (err) {
      jsonResponse(res, 500, { error: String(err) });
    }
    return true;
  }

  if (url === "/api/intelligence/review-queue" && method === "GET") {
    const items = HumanReviewQueue.getInstance().listPending();
    jsonResponse(res, 200, { status: "success", data: items });
    return true;
  }

  if (url.startsWith("/api/intelligence/review-queue/") && url.endsWith("/resolve") && method === "POST") {
    const reviewId = url.split("/")[4];
    try {
      const body = await parseJsonBody<{
        status: "APPROVED" | "REJECTED" | "CORRECTED";
        humanValue?: unknown;
        humanReason?: string;
        actorId?: string;
      }>(req);
      const resolved = HumanReviewQueue.getInstance().resolve(reviewId, body);
      if (!resolved) {
        jsonResponse(res, 404, { error: "Review item not found" });
        return true;
      }
      jsonResponse(res, 200, { status: "success", data: resolved });
    } catch (err) {
      jsonResponse(res, 500, { error: String(err) });
    }
    return true;
  }

  if (url === "/api/intelligence/metrics" && method === "GET") {
    const snapshot = IntelligenceMetricsCollector.getInstance().getSnapshot();
    jsonResponse(res, 200, { status: "success", data: snapshot });
    return true;
  }

  return false;
}
