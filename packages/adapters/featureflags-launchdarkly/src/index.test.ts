/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import LDClient from "launchdarkly-node-server-sdk";
import { LaunchDarklyFeatureFlagsAdapter } from "./index";

describe("LaunchDarklyFeatureFlagsAdapter", () => {
  it("interacts with LaunchDarkly Client variation correctly", async () => {
    let queriedFlag: string = "";
    let queriedUser: any = null;

    const mockClient: any = {
      variation: async (flagKey: string, user: any, defaultValue: any) => {
        queriedFlag = flagKey;
        queriedUser = user;
        if (flagKey === "my-boolean-flag") return true;
        return defaultValue;
      },
      close: async () => {},
    };

    const adapter = new LaunchDarklyFeatureFlagsAdapter(
      mockClient as unknown as LDClient.LDClient,
    );

    const active = await adapter.isEnabled("my-boolean-flag", {
      key: "u123",
      email: "test@example.com",
    });
    expect(active).toBe(true);
    expect(queriedFlag).toBe("my-boolean-flag");
    expect(queriedUser).toEqual({
      key: "u123",
      email: "test@example.com",
      custom: undefined,
    });
  });

  it("throws when no configuration is provided", () => {
    expect(() => new LaunchDarklyFeatureFlagsAdapter()).toThrow(/sdkKey/i);
  });

  it("throws when the config has no sdkKey", () => {
    expect(() => new LaunchDarklyFeatureFlagsAdapter({})).toThrow(/sdkKey/i);
    expect(() => new LaunchDarklyFeatureFlagsAdapter({ sdkKey: "" })).toThrow(
      /sdkKey/i,
    );
  });

  it("uses the explicit offline mock client when { mock: true } is provided", async () => {
    const adapter = new LaunchDarklyFeatureFlagsAdapter({ mock: true });

    await expect(
      adapter.isEnabled("my-boolean-flag", { key: "u123" }),
    ).resolves.toBe(false);
    await expect(
      adapter.isEnabled("my-boolean-flag", { key: "u123" }, true),
    ).resolves.toBe(true);
    await expect(
      adapter.getVariation("my-string-flag", undefined, "fallback"),
    ).resolves.toBe("fallback");
    await expect(adapter.close()).resolves.toBeUndefined();
  });
});
