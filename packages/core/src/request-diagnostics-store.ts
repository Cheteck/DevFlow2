/**
 * @mosaix/core — RequestDiagnosticsStore (P0)
 * Ring buffer behind interface, redaction, no globalThis.
 */

export interface RequestDiagnostic {
  ts: string;
  method: string;
  path: string; // redacted
  status: number;
  dur: string;
}

const SENSITIVE_QUERY_KEYS = new Set(["token", "access_token", "refresh_token", "password", "secret", "key"]);
const SENSITIVE_HEADER_KEYS = new Set(["authorization", "cookie", "x-api-key"]);

function redactPath(path: string): string {
  try {
    const url = new URL(path, "http://localhost");
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, "***");
      }
    }
    return url.pathname + (url.search ? url.search : "");
  } catch {
    return path.split("?")[0] ?? path;
  }
}

export function redactHeaders(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(k.toLowerCase())) {
      out[k] = "***";
    } else if (typeof v === "string") {
      out[k] = v;
    } else if (v !== undefined) {
      out[k] = String(v);
    }
  }
  return out;
}

export interface RequestDiagnosticsStore {
  append(entry: Omit<RequestDiagnostic, "ts"> & { ts?: string }): void;
  recent(limit: number): RequestDiagnostic[];
  clear(): void;
}

export class InMemoryRequestDiagnosticsStore implements RequestDiagnosticsStore {
  private buffer: RequestDiagnostic[] = [];
  constructor(private readonly maxSize = 100) {}

  append(entry: Omit<RequestDiagnostic, "ts"> & { ts?: string }): void {
    const rec: RequestDiagnostic = {
      ts: entry.ts ?? new Date().toISOString(),
      method: entry.method,
      path: redactPath(entry.path),
      status: entry.status,
      dur: entry.dur,
    };
    this.buffer.push(rec);
    if (this.buffer.length > this.maxSize) this.buffer.shift();
  }

  recent(limit: number): RequestDiagnostic[] {
    return this.buffer.slice(-limit).reverse();
  }

  clear(): void {
    this.buffer.length = 0;
  }
}

export const requestDiagnosticsStore = new InMemoryRequestDiagnosticsStore();
