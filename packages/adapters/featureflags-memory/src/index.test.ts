import { describe, expect, it } from "vitest";
import { MemoryFeatureFlagsAdapter } from "./index";

describe("MemoryFeatureFlagsAdapter", () => {
  it("can set and evaluate feature flags", async () => {
    const provider = new MemoryFeatureFlagsAdapter();

    await expect(
      provider.isEnabled("new-feature", { key: "u1" }, true),
    ).resolves.toBe(true);

    provider.setFlag("new-feature", false);
    await expect(
      provider.isEnabled("new-feature", { key: "u1" }, true),
    ).resolves.toBe(false);

    provider.setFlag("button-color", "blue");
    await expect(
      provider.getVariation("button-color", { key: "u1" }, "red"),
    ).resolves.toBe("blue");
  });
});
