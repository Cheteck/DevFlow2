import { describe, expect, it } from "vitest";
import { CapabilityRegistry, IntelligenceRuntime, ProviderRouter } from "@mosaix/intelligence";
import { TypeSafeJevProvider } from "./index.js";

describe("TypeSafe / Jev System One Intelligence Adapter", () => {
  it("executes Jev provider decisions with confidence probabilities", async () => {
    const jevProvider = new TypeSafeJevProvider({ apiKey: "jev_test_key" });
    const router = new ProviderRouter();
    router.register(jevProvider);

    const cap = CapabilityRegistry.getInstance().get("commerce.product.classify");
    if (cap) {
      cap.allowedProviders = ["typesafe", "mock"];
    }

    const runtime = new IntelligenceRuntime(router);
    const result = await runtime.decide({
      capability: "commerce.product.classify",
      state: { title: "Apple iPhone 16 Pro Max 256GB" },
    });

    expect(result.provider).toBe("typesafe");
    expect(result.model).toBe("jev-system-one-v1");
    expect(result.probabilities?.smartphones).toBeGreaterThan(0.9);
    expect((result.value as { brand: string }).brand).toBe("Apple");
  });

  it("evaluates seller risk scores using Jev provider", async () => {
    const jevProvider = new TypeSafeJevProvider();
    const result = await jevProvider.decide({
      capability: "commerce.seller.risk.score",
      state: { cancellationRate: 0.22 },
    });

    expect(result.provider).toBe("typesafe");
    expect((result.value as { rating: string }).rating).toBe("HIGH_RISK");
  });
});
