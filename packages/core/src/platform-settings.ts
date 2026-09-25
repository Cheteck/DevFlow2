/**
 * @mosaix/core — Platform Settings & Dynamic BAC Routing Service
 * Single source of truth for platform-level configurations: default BAC, maintenance, and fallbacks.
 */

import type { PlatformSettings } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";

export interface PlatformSettingsPort {
  getSettings(): Promise<PlatformSettings>;
  updateSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings>;
}

export const CANONICAL_DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  defaultBacId: process.env.MOSAIX_DEFAULT_BAC || "solara",
  fallbackBacId: "citadelle",
  platformName: "MosaiX Platform",
  maintenanceMode: false,
  allowedRolesInMaintenance: ["admin", "superadmin"],
  unauthenticatedStrategy: "render_auth_bac",
  authBacId: "citadelle",
  metadata: {},
};

export class InMemoryPlatformSettingsStore implements PlatformSettingsPort {
  private settings: PlatformSettings;

  constructor(initialSettings: Partial<PlatformSettings> = {}) {
    this.settings = {
      ...CANONICAL_DEFAULT_PLATFORM_SETTINGS,
      ...initialSettings,
    };
  }

  async getSettings(): Promise<PlatformSettings> {
    return { ...this.settings };
  }

  async updateSettings(partial: Partial<PlatformSettings>): Promise<PlatformSettings> {
    this.settings = {
      ...this.settings,
      ...partial,
      metadata: {
        ...this.settings.metadata,
        ...partial.metadata,
      },
    };
    return { ...this.settings };
  }
}

export class PostgresPlatformSettingsStore implements PlatformSettingsPort {
  private memoryFallback: InMemoryPlatformSettingsStore;
  private tableName = "platform_settings";

  constructor(
    private readonly db: DatabasePort,
    initialFallback: Partial<PlatformSettings> = {}
  ) {
    this.memoryFallback = new InMemoryPlatformSettingsStore(initialFallback);
  }

  async init(): Promise<void> {
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS "${this.tableName}" (
          key VARCHAR(128) PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    } catch {
      // Ignored if table creation is handled by migrator
    }
  }

  async getSettings(): Promise<PlatformSettings> {
    try {
      const rows = await this.db.query<{ key: string; value: string | Record<string, unknown> }>(
        `SELECT key, value FROM "${this.tableName}" WHERE key = 'current'`
      );
      if (rows && rows.length > 0) {
        const val = rows[0].value;
        const parsed = typeof val === "string" ? JSON.parse(val) : val;
        return {
          ...CANONICAL_DEFAULT_PLATFORM_SETTINGS,
          ...parsed,
        };
      }
    } catch {
      // Fallback to memory on failure or missing table
    }
    return this.memoryFallback.getSettings();
  }

  async updateSettings(partial: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const current = await this.getSettings();
    const updated: PlatformSettings = {
      ...current,
      ...partial,
    };

    try {
      await this.db.execute(
        `INSERT INTO "${this.tableName}" (key, value, updated_at)
         VALUES ('current', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(updated)]
      );
    } catch {
      // If DB write fails, update memory fallback
    }

    return this.memoryFallback.updateSettings(updated);
  }
}

export class PlatformSettingsService {
  private cachedSettings: PlatformSettings | null = null;
  private cacheTtlMs = 15000;
  private lastFetchedAt = 0;

  constructor(private readonly store: PlatformSettingsPort = new InMemoryPlatformSettingsStore()) {}

  async getSettings(forceRefresh = false): Promise<PlatformSettings> {
    const now = Date.now();
    if (!forceRefresh && this.cachedSettings && now - this.lastFetchedAt < this.cacheTtlMs) {
      return this.cachedSettings;
    }

    const settings = await this.store.getSettings();
    this.cachedSettings = settings;
    this.lastFetchedAt = now;
    return settings;
  }

  async getDefaultBacId(): Promise<string> {
    const settings = await this.getSettings();
    return settings.defaultBacId || "solara";
  }

  async setDefaultBacId(bacId: string): Promise<PlatformSettings> {
    const updated = await this.store.updateSettings({ defaultBacId: bacId });
    this.cachedSettings = updated;
    this.lastFetchedAt = Date.now();
    return updated;
  }

  async updateSettings(partial: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const updated = await this.store.updateSettings(partial);
    this.cachedSettings = updated;
    this.lastFetchedAt = Date.now();
    return updated;
  }
}

export const platformSettingsService = new PlatformSettingsService();
