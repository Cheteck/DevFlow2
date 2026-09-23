import { describe, it, expect } from "vitest";
import { KernelContext } from "../kernel-module";
import { InfrastructureModule } from "./infrastructure-module";

describe("InfrastructureModule", () => {
  it("registers provided infrastructure services into KernelContext", () => {
    const ctx = new KernelContext();

    const mockClock = { now: () => new Date() };
    const mockId = { generate: () => "id-123" };
    const mockCache = { get: async () => null };
    const mockStorage = { put: async () => {} };
    const mockSearch = { search: async () => [] };
    const mockFeatureFlags = { isEnabled: async () => false };
    const mockDatabase = { query: async () => [] };
    const mockMessageBus = { publish: async () => {} };
    const mockEventStore = { append: async () => {} };
    const mockPubsub = { publish: async () => {} };
    const mockCrypto = { hash: async () => "hash" };
    const mockLogging = { info: () => {} };
    const mockMetrics = { increment: () => {} };
    const mockTracing = { startSpan: () => {} };

    const module = new InfrastructureModule({
      clock: mockClock,
      id: mockId,
      cache: mockCache,
      storage: mockStorage,
      search: mockSearch,
      featureFlags: mockFeatureFlags,
      database: mockDatabase,
      messageBus: mockMessageBus,
      eventStore: mockEventStore,
      pubsub: mockPubsub,
      crypto: mockCrypto,
      logging: mockLogging,
      metrics: mockMetrics,
      tracing: mockTracing,
      customPort: "custom-value",
    });

    module.register(ctx);

    expect(ctx.getService("clock")).toBe(mockClock);
    expect(ctx.getService("id")).toBe(mockId);
    expect(ctx.getService("cache")).toBe(mockCache);
    expect(ctx.getService("storage")).toBe(mockStorage);
    expect(ctx.getService("search")).toBe(mockSearch);
    expect(ctx.getService("featureFlags")).toBe(mockFeatureFlags);
    expect(ctx.getService("database")).toBe(mockDatabase);
    expect(ctx.getService("messageBus")).toBe(mockMessageBus);
    expect(ctx.getService("eventStore")).toBe(mockEventStore);
    expect(ctx.getService("pubsub")).toBe(mockPubsub);
    expect(ctx.getService("crypto")).toBe(mockCrypto);
    expect(ctx.getService("logging")).toBe(mockLogging);
    expect(ctx.getService("metrics")).toBe(mockMetrics);
    expect(ctx.getService("tracing")).toBe(mockTracing);
    expect(ctx.getService("customPort")).toBe("custom-value");
  });

  it("handles empty options cleanly", () => {
    const ctx = new KernelContext();
    const module = new InfrastructureModule({});
    module.register(ctx);
    expect(ctx.getService("cache")).toBeUndefined();
  });
});
