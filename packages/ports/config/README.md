# @mosaix/ports-config

Configuration lookup port for the MosaiX platform. Decouples application configuration from environment variables, files or vault systems.

## Exports

```typescript
export interface ConfigPort {
  get(key: string): string | undefined;
  getOrDefault(key: string, defaultValue: string): string;
  getRequired(key: string): string;
}
```

## Usage

```typescript
import type { ConfigPort } from "@mosaix/ports-config";

class MyService {
  constructor(private readonly config: ConfigPort) {}

  start() {
    const port = this.config.getOrDefault("PORT", "3000");
    const host = this.config.getRequired("DB_HOST"); // throws if missing
    // ...
  }
}
```

## Adapters

- [`@mosaix/adapter-config-env`](../../adapters/config-env) — environment variables (`process.env` or a custom source).
