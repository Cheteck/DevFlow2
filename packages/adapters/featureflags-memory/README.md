# @mosaix/adapter-featureflags-memory

In-memory feature flags adapter implementing [`FeatureFlagsPort`](../../ports/feature-flags). Ideal for tests and local development.

## Features

- Flags stored as booleans or strings.
- `setFlag(key, value)` — sets a flag at runtime.
- `clear()` — resets all flags.
- Evaluation ignores the user context (flags are global); missing or mistyped values fall back to the default.

## Usage

```typescript
import { MemoryFeatureFlagsAdapter } from "@mosaix/adapter-featureflags-memory";

const flags = new MemoryFeatureFlagsAdapter();
flags.setFlag("my-feature", true);
flags.setFlag("pricing-model", "monthly");

const active = await flags.isEnabled("my-feature", { key: "user-123" }); // true
const variant = await flags.getVariation("pricing-model"); // "monthly"
```

## Related

- Port: [`@mosaix/ports-feature-flags`](../../ports/feature-flags)
