/**
 * @server/utils — Safe HTTP Request Body Parser
 * Protects against denial-of-service (DoS) memory exhaustion by enforcing payload size ceilings.
 */

import type * as http from "node:http";

export class PayloadTooLargeError extends Error {
  constructor(message = "Payload Too Large: maximum allowed body size exceeded") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Reads stream chunks up to maxBytes. Throws PayloadTooLargeError if exceeded.
 */
export async function readLimitedBody(
  req: http.IncomingMessage,
  maxBytes: number = 1024 * 1024 // 1 MB default ceiling
): Promise<string> {
  const declaredLength = parseInt(req.headers["content-length"] || "0", 10);
  if (declaredLength > maxBytes) {
    throw new PayloadTooLargeError(
      `Declared Content-Length (${declaredLength} bytes) exceeds limit (${maxBytes} bytes).`
    );
  }

  return new Promise<string>((resolve, reject) => {
    let body = "";
    let receivedBytes = 0;
    let exceeded = false;

    const onData = (chunk: Buffer | string) => {
      if (exceeded) return;
      receivedBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      if (receivedBytes > maxBytes) {
        exceeded = true;
        req.pause();
        cleanup();
        reject(
          new PayloadTooLargeError(
            `Payload stream exceeded maximum allowed size of ${maxBytes} bytes.`
          )
        );
        return;
      }
      body += chunk;
    };

    const onEnd = () => {
      if (exceeded) return;
      cleanup();
      resolve(body);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

/**
 * Reads limited body and safely parses as JSON.
 */
export async function readLimitedJson<T = Record<string, unknown>>(
  req: http.IncomingMessage,
  maxBytes: number = 1024 * 1024
): Promise<T> {
  const raw = await readLimitedBody(req, maxBytes);
  if (!raw || !raw.trim()) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}
