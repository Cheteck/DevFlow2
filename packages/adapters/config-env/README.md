# @mosaix/adapter-config-env

Environment configuration adapter implementing [`ConfigPort`](../../ports/config).

## Constructor

```typescript
new EnvConfigAdapter(customSource?: Record<string, string | undefined>);
```

- **nothing** — reads from `process.env`.
- **customSource** — an explicit key/value map (useful in tests).

## Behavior

- `get` returns the value or `undefined`.
- `getOrDefault` returns the value or the provided default.
- `getRequired` throws `Required configuration key "<key>" is missing` when the key is absent.

## Usage

```typescript
import { EnvConfigAdapter } from "@mosaix/adapter-config-env";

const config = new EnvConfigAdapter();
const dbHost = config.getRequired("DB_HOST");
const port = config.getOrDefault("PORT", "3000");
```

## Related

- Port: [`@mosaix/ports-config`](../../ports/config)
