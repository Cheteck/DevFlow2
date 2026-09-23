# @mosaix/ports-http

HTTP client port for the MosaiX platform. Decouples application HTTP calls from fetch, axios or other clients.

## Exports

```typescript
export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string | Buffer | unknown;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  json<T>(): T;
}

export interface HttpPort {
  send(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
  get(
    url: string,
    options?: Omit<HttpRequestOptions, "method">,
  ): Promise<HttpResponse>;
  post(
    url: string,
    body?: unknown,
    options?: Omit<HttpRequestOptions, "method" | "body">,
  ): Promise<HttpResponse>;
}
```

## Notes

- `body` of a non-string/Buffer type is JSON-serialized by implementations (which also set `Content-Type: application/json`).
- `timeout` is expressed in milliseconds; the adapter aborts the request and throws on timeout.

## Usage

```typescript
import type { HttpPort } from "@mosaix/ports-http";

class MyService {
  constructor(private readonly http: HttpPort) {}

  async fetchUsers() {
    const res = await this.http.get("https://api.example.com/users", {
      timeout: 5000,
    });
    return res.json<User[]>();
  }
}
```

## Adapters

- [`@mosaix/adapter-http-fetch`](../../adapters/http-fetch) — native `fetch` with `AbortController` timeouts.
