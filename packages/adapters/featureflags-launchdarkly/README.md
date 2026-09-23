# @mosaix/adapter-featureflags-launchdarkly

LaunchDarkly feature flags adapter implementing [`FeatureFlagsPort`](../../ports/feature-flags), built on `launchdarkly-node-server-sdk`.

## Constructor

```typescript
new LaunchDarklyFeatureFlagsAdapter(clientOrConfig?: LDClient | LaunchDarklyConfig);
```

- **LDClient** — use an existing initialized client (detected via the `variation` method).
- **config object** — `{ sdkKey: string }` (required) or `{ mock: true }` for the explicit offline mock client (returns defaults, never contacts LaunchDarkly).
- **nothing** — **throws**: `sdkKey` is required; there is no silent `"mockKey"` fallback.

## Features

- Maps [`FeatureFlagUserContext`](../../ports/feature-flags) to an LD user (`key`, `email`, `custom`). Without a context, uses `{ key: "anonymous" }`.
- `isEnabled` / `getVariation` are resolved through `client.variation` with the provided defaults.
- `close()` — shuts the LD client down (not part of the port; call during shutdown).

## Usage

```typescript
import { LaunchDarklyFeatureFlagsAdapter } from "@mosaix/adapter-featureflags-launchdarkly";

const flags = new LaunchDarklyFeatureFlagsAdapter({ sdkKey: "sdk-..." });
const active = await flags.isEnabled("new-pricing", { key: "user-9" });
const variant = await flags.getVariation("pricing-model", undefined, "monthly");
await flags.close();
```

## Related

- Port: [`@mosaix/ports-feature-flags`](../../ports/feature-flags)
