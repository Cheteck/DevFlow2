import LDClient from "launchdarkly-node-server-sdk";
import type {
  FeatureFlagsPort,
  FeatureFlagUserContext,
} from "@mosaix/ports-feature-flags";

export interface LaunchDarklyConfig {
  /** LaunchDarkly server-side SDK key. */
  sdkKey?: string;
  /** Explicitly opt into the offline mock client (never contacts LaunchDarkly). */
  mock?: boolean;
}

/** Minimal surface the adapter relies on for the explicit mock mode. */
interface MockLDClient {
  variation<T>(
    key: string,
    context: LDClient.LDContext,
    defaultValue: T,
  ): Promise<T>;
  close(): Promise<void> | void;
}

function createMockLDClient(): MockLDClient {
  return {
    async variation<T>(
      _key: string,
      _context: LDClient.LDContext,
      defaultValue: T,
    ): Promise<T> {
      return defaultValue;
    },
    async close(): Promise<void> {},
  };
}

export class LaunchDarklyFeatureFlagsAdapter implements FeatureFlagsPort {
  private readonly client: LDClient.LDClient | MockLDClient;

  constructor(clientOrConfig?: LDClient.LDClient | LaunchDarklyConfig) {
    if (
      clientOrConfig &&
      typeof clientOrConfig === "object" &&
      "variation" in clientOrConfig
    ) {
      this.client = clientOrConfig as LDClient.LDClient;
      return;
    }

    const config: LaunchDarklyConfig =
      clientOrConfig ?? ({} as LaunchDarklyConfig);

    if (config.mock === true) {
      this.client = createMockLDClient();
      return;
    }

    if (typeof config.sdkKey !== "string" || config.sdkKey.length === 0) {
      throw new Error(
        "LaunchDarklyFeatureFlagsAdapter: sdkKey is required. Provide an LDClient instance, a config with `sdkKey`, or `{ mock: true }` to explicitly opt into the offline mock client.",
      );
    }

    this.client = LDClient.init(config.sdkKey);
  }

  private mapContext(context?: FeatureFlagUserContext): LDClient.LDUser {
    if (!context) {
      return { key: "anonymous" };
    }
    const user: LDClient.LDUser = { key: context.key };
    if (context.email !== undefined) {
      user.email = context.email;
    }
    if (context.custom !== undefined) {
      user.custom = context.custom;
    }
    return user;
  }

  async isEnabled(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue = false,
  ): Promise<boolean> {
    const ldContext = this.mapContext(context);
    return await this.client.variation(flagKey, ldContext, defaultValue);
  }

  async getVariation(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue = "",
  ): Promise<string> {
    const ldContext = this.mapContext(context);
    return await this.client.variation(flagKey, ldContext, defaultValue);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
