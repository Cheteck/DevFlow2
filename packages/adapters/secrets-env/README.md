# @mosaix/adapter-secrets-env

Environment secrets adapter implementing [`SecretsPort`](../../ports/secrets).

## Constructor

```typescript
new EnvSecretsAdapter(customSource?: Record<string, string | undefined>);
```

- **nothing** — reads from `process.env`.
- **customSource** — an explicit key/value map (useful in tests).

## Behavior

- `getSecret` returns the value or `undefined`.
- `getRequiredSecret` throws `Required secret key "<key>" is missing` when the key is absent.

## Usage

```typescript
import { EnvSecretsAdapter } from "@mosaix/adapter-secrets-env";

const secrets = new EnvSecretsAdapter();
const apiKey = await secrets.getRequiredSecret("STRIPE_SECRET_KEY");
const optional = await secrets.getSecret("FEATURE_TOKEN");
```

## Related

- Port: [`@mosaix/ports-secrets`](../../ports/secrets)
