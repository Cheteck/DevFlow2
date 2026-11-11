/**
 * @apps/citadelle — Safe body parser
 * Limits request body size to prevent DoS attacks.
 */

export async function readLimitedJson(
  req: import("http").IncomingMessage,
  maxSize: number = 1024 * 1024, // 1 MB default
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    let received = 0;

    req.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxSize) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}") as Record<string, unknown>);
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}
