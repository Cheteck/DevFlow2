# @mosaix/ports-secrets

Secrets retrieval port for the MosaiX platform. Decouples application secrets access (API keys, DB credentials) from the storage backend (env, vaults, cloud secret managers).

## Exports

```typescript
export interface SecretsPort {
  getSecret(key: string): Promise<string | undefined>;
  getRequiredSecret(key: string): Promise<string>;
}
```

## Usage

```typescript
import type { SecretsPort } from "@mosaix/ports-secrets";

class MyService {
  constructor(private readonly secrets: SecretsPort) {}

  async start() {
    const apiKey = await this.secrets.getRequiredSecret("STRIPE_API_KEY"); // throws if missing
    const optional = await this.secrets.getSecret("FEATURE_TOKEN"); // undefined if missing
    // ...
  }
}
```

## Adapters

- [`@mosaix/adapter-secrets-env`](../../adapters/secrets-env) — environment variables (`process.env` or a custom source).
