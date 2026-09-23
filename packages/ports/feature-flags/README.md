# @mosaix/ports-feature-flags

Feature flags evaluation port for the MosaiX platform. Decouples application toggles from LaunchDarkly, Split, Unleash, etc.

## Exports

```typescript
export interface FeatureFlagUserContext {
  key: string;
  email?: string;
  custom?: Record<string, string | number | boolean>;
}

export interface FeatureFlagsPort {
  isEnabled(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue?: boolean,
  ): Promise<boolean>;
  getVariation(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue?: string,
  ): Promise<string>;
}
```

## Usage

```typescript
import type { FeatureFlagsPort } from "@mosaix/ports-feature-flags";

class MyService {
  constructor(private readonly flags: FeatureFlagsPort) {}

  async checkAccess(userKey: string) {
    const active = await this.flags.isEnabled("new-dashboard", {
      key: userKey,
      email: "user@example.com",
    });
    const variant = await this.flags.getVariation(
      "pricing-model",
      undefined,
      "monthly",
    );
    // ...
  }
}
```

## Adapters

- [`@mosaix/adapter-featureflags-memory`](../../adapters/featureflags-memory) — in-memory flags (`setFlag`, `clear`), for tests and local dev.
- [`@mosaix/adapter-featureflags-launchdarkly`](../../adapters/featureflags-launchdarkly) — LaunchDarkly server SDK.
