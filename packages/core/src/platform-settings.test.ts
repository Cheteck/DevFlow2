import { describe, it, expect } from "vitest";
import {
  PlatformSettingsService,
  InMemoryPlatformSettingsStore,
  CANONICAL_DEFAULT_PLATFORM_SETTINGS,
} from "./platform-settings.js";

describe("PlatformSettingsService", () => {
  it("initializes with canonical default settings", async () => {
    const store = new InMemoryPlatformSettingsStore();
    const service = new PlatformSettingsService(store);
    const settings = await service.getSettings();

    expect(settings.defaultBacId).toBeDefined();
    expect(settings.fallbackBacId).toBe("citadelle");
    expect(settings.platformName).toBe("MosaiX Platform");
    expect(settings.maintenanceMode).toBe(false);
  });

  it("updates and caches defaultBacId dynamically", async () => {
    const store = new InMemoryPlatformSettingsStore();
    const service = new PlatformSettingsService(store);

    await service.setDefaultBacId("solara");
    expect(await service.getDefaultBacId()).toBe("solara");

    // Change to another BAC dynamically without restarting shell
    await service.setDefaultBacId("portfolio");
    expect(await service.getDefaultBacId()).toBe("portfolio");

    // Partial update
    await service.updateSettings({ platformName: "IJIDeals Marketplace" });
    const settings = await service.getSettings();
    expect(settings.platformName).toBe("IJIDeals Marketplace");
    expect(settings.defaultBacId).toBe("portfolio");
  });
});
