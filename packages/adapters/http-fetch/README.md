# @mosaix/adapter-http-fetch

HTTP client adapter implementing [`HttpPort`](../../ports/http), built on the native `fetch`.

## Features

- **Methods** — `send`, `get`, `post` (GET default).
- **Body** — strings/Buffers pass through; other values are JSON-serialized with `Content-Type: application/json` added when no header is set.
- **Timeout** — `options.timeout` (ms) aborts the request via `AbortController` and throws `HTTP request timed out after <timeout>ms`.
- **Response** — `.json<T>()` parses the response body.

## Usage

```typescript
import { FetchHttpAdapter } from "@mosaix/adapter-http-fetch";

const client = new FetchHttpAdapter();

const res = await client.get("https://api.example.com/users", {
  timeout: 5000,
});
const users = res.json<User[]>();

await client.post("https://api.example.com/users", { name: "Ada" });
```

## Related

- Port: [`@mosaix/ports-http`](../../ports/http)
