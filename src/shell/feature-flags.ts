import { DistributedEventBackplane } from "./event-backplane.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { MemoryFeatureFlagsAdapter } from "@mosaix/adapter-featureflags-memory";
import { PostgresFeatureFlagsAdapter } from "@mosaix/adapter-featureflags-postgres";
import type { DatabasePort } from "@mosaix/ports-database";
import {
  FeatureFlagEvaluator,
  FEATURE_FLAG_REGISTRY,
  getDefaultValueForEnvironment,
  type FeatureFlagDefinition,
  type FeatureFlagUserContext,
  type FeatureFlagKey,
  type FeatureEnvironment,
} from "@mosaix/ports-feature-flags";
import { registerFeatureFlagsProvider } from "@mosaix/sdk";
import { isDemoMode } from "./profiles.js";

const FEATURE_FLAGS_FILE = path.resolve(
  process.cwd(),
  ".mosaix/feature-flags.json",
);

export class PersistentFeatureFlagsManager {
  private readonly adapter:
    | MemoryFeatureFlagsAdapter
    | PostgresFeatureFlagsAdapter;
  private readonly flagMetadata = new Map<string, FeatureFlagDefinition>();

  constructor(db?: DatabasePort) {
    if (db) {
      this.adapter = new PostgresFeatureFlagsAdapter(db);
    } else if (!isDemoMode()) {
      throw new Error(
        "[FeatureFlags] Refused: no DatabasePort and demo mode is off " +
          "(MOSAIX_DEMO_USERS=false). Pass the database adapter — " +
          "in-memory flag storage is demo-only.",
      );
    } else {
      this.adapter = new MemoryFeatureFlagsAdapter();
    }
    this.init();
  }

  public getCurrentEnvironment(): FeatureEnvironment {
    return (process.env.MOSAIX_ENV || process.env.NODE_ENV || "development") as FeatureEnvironment;
  }

  private init() {
    if (this.adapter instanceof PostgresFeatureFlagsAdapter) {
      void this.adapter.init();
    }

    const currentEnv = this.getCurrentEnvironment();

    // 1. Load canonical FEATURE_FLAG_REGISTRY with environment-aware defaults
    for (const [key, catalogDef] of Object.entries(FEATURE_FLAG_REGISTRY)) {
      const envDefault = getDefaultValueForEnvironment(key, currentEnv);
      this.adapter.setFlag(key, envDefault, catalogDef.description, {
        category: catalogDef.category,
        rolesAllowlist: catalogDef.rolesAllowlist,
      });
      this.flagMetadata.set(key, { ...catalogDef, defaultValue: envDefault });
    }

    // 2. Load disk overrides if existing (only for memory adapter)
    if (this.adapter instanceof MemoryFeatureFlagsAdapter) {
      try {
        if (fs.existsSync(FEATURE_FLAGS_FILE)) {
          const raw = fs.readFileSync(FEATURE_FLAGS_FILE, "utf-8");
          const parsed = JSON.parse(raw);
          if (typeof parsed === "object" && parsed !== null) {
            for (const [key, flagRecord] of Object.entries(parsed)) {
              const record = flagRecord as {
                value?: boolean | string;
                defaultValue?: boolean | string;
                description?: string;
                rolesAllowlist?: string[];
                usersAllowlist?: string[];
                tenantsAllowlist?: string[];
                plansAllowlist?: string[];
                percentageRollout?: number;
              };
              const val =
                record?.value !== undefined
                  ? record.value
                  : record?.defaultValue !== undefined
                  ? record.defaultValue
                  : flagRecord;

              if (val !== undefined && typeof val !== "object") {
                const desc = record?.description;
                this.adapter.setFlag(key, val as boolean | string, desc);
                if (typeof flagRecord === "object" && flagRecord !== null) {
                  const existingMeta = this.flagMetadata.get(key) || {
                    key,
                    defaultValue: val as boolean | string,
                  };
                  this.flagMetadata.set(key, {
                    ...existingMeta,
                    rolesAllowlist: record.rolesAllowlist ?? existingMeta.rolesAllowlist,
                    usersAllowlist: record.usersAllowlist ?? existingMeta.usersAllowlist,
                    tenantsAllowlist: record.tenantsAllowlist ?? existingMeta.tenantsAllowlist,
                    plansAllowlist: record.plansAllowlist ?? existingMeta.plansAllowlist,
                    percentageRollout: record.percentageRollout ?? existingMeta.percentageRollout,
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn(
          "[FeatureFlags] Failed to read .mosaix/feature-flags.json:",
          e,
        );
      }
    }

    // 3. Register as global SDK provider
    registerFeatureFlagsProvider(this.adapter);
  }

  public getAdapter(): MemoryFeatureFlagsAdapter | PostgresFeatureFlagsAdapter {
    return this.adapter;
  }

  public getEnvVariableOverride(key: string): boolean | string | undefined {
    const envKey = `MOSAIX_FLAG_${key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    const envVal = process.env[envKey];
    if (envVal === undefined) return undefined;
    if (envVal === "true") return true;
    if (envVal === "false") return false;
    return envVal;
  }

  public async isEnabled(
    key: FeatureFlagKey | string,
    context?: FeatureFlagUserContext,
    defaultValue = false,
  ): Promise<boolean> {
    const envOverride = this.getEnvVariableOverride(key);
    if (typeof envOverride === "boolean") {
      return envOverride;
    }

    const baseResult = await this.adapter.isEnabled(key, context, defaultValue);
    const meta = this.flagMetadata.get(key);
    if (!meta) return baseResult;

    // Delegate targeting evaluation to FeatureFlagEvaluator
    return FeatureFlagEvaluator.evaluateTargeting(
      { ...meta, defaultValue: baseResult },
      context,
    );
  }

  public isEnabledSync(key: FeatureFlagKey | string, defaultValue = false): boolean {
    const envOverride = this.getEnvVariableOverride(key);
    if (typeof envOverride === "boolean") {
      return envOverride;
    }

    const syncRead = this.adapter.isEnabledSync?.bind(this.adapter);
    if (typeof syncRead === "function") return syncRead(key, defaultValue);
    return defaultValue;
  }

  public async listFlags(): Promise<FeatureFlagDefinition[]> {
    const flagsFromAdapter = await this.adapter.listFlags();
    return flagsFromAdapter.map((f) => {
      const meta = this.flagMetadata.get(f.key);
      const envOverride = this.getEnvVariableOverride(f.key);
      return {
        ...f,
        ...meta,
        defaultValue: envOverride !== undefined ? (envOverride as boolean | string) : f.defaultValue,
      };
    });
  }

  public async setFlag(
    key: FeatureFlagKey | string,
    value: boolean | string,
    description?: string,
    options?: Partial<FeatureFlagDefinition>,
  ): Promise<void> {
    await this.adapter.setFlag(key, value, description, options);
    if (options || value !== undefined) {
      const existing = this.flagMetadata.get(key) || { key, defaultValue: value };
      this.flagMetadata.set(key, {
        ...existing,
        ...options,
        defaultValue: value,
      });
    }
    await this.saveToDisk();
    try {
      DistributedEventBackplane.getInstance().publish("platform.feature_flag.updated", {
        key,
        value,
        timestamp: Date.now(),
      });
    } catch {
      // ignore if Backplane is not bootstrapped in standalone test mocks
    }
  }

  public async resetToDefault(key: FeatureFlagKey | string): Promise<void> {
    const currentEnv = this.getCurrentEnvironment();
    const envDefault = getDefaultValueForEnvironment(key, currentEnv);
    const catalogMeta = (FEATURE_FLAG_REGISTRY as Record<string, FeatureFlagDefinition>)[key];

    await this.setFlag(key, envDefault, catalogMeta?.description, catalogMeta);
  }

  public async toggleFlag(key: FeatureFlagKey | string): Promise<boolean> {
    const current = await this.adapter.isEnabled(key, undefined, false);
    const updated = !current;
    await this.setFlag(key, updated);
    return updated;
  }

  public async getAllFlagsSnapshot(
    context?: FeatureFlagUserContext,
  ): Promise<Record<string, boolean | string>> {
    const allFlags = await this.listFlags();
    const snapshot: Record<string, boolean | string> = {};

    for (const flag of allFlags) {
      const evaluated = await this.isEnabled(flag.key, context, Boolean(flag.defaultValue));
      snapshot[flag.key] = evaluated;
    }

    return snapshot;
  }

  private isSaving = false;
  private pendingSave = false;

  private async saveToDisk(): Promise<void> {
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }
    this.isSaving = true;
    try {
      const dir = path.dirname(FEATURE_FLAGS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const flags = await this.listFlags();
      const record: Record<string, FeatureFlagDefinition> = {};
      for (const f of flags) {
        record[f.key] = f;
      }
      fs.writeFileSync(
        FEATURE_FLAGS_FILE,
        JSON.stringify(record, null, 2),
        "utf-8",
      );
    } catch (e) {
      console.error("[FeatureFlags] Failed to persist flags to disk:", e);
    } finally {
      this.isSaving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        await this.saveToDisk();
      }
    }
  }
}

let platformFeatureFlagsInstance: PersistentFeatureFlagsManager | null = null;

export function getPlatformFeatureFlags(db?: DatabasePort): PersistentFeatureFlagsManager {
  if (!platformFeatureFlagsInstance) {
    platformFeatureFlagsInstance = new PersistentFeatureFlagsManager(db);
  }
  return platformFeatureFlagsInstance;
}

export const platformFeatureFlags = {
  get isEnabled(): PersistentFeatureFlagsManager["isEnabled"] {
    return getPlatformFeatureFlags().isEnabled.bind(getPlatformFeatureFlags());
  },
  get isEnabledSync(): PersistentFeatureFlagsManager["isEnabledSync"] {
    return getPlatformFeatureFlags().isEnabledSync.bind(getPlatformFeatureFlags());
  },
  get listFlags(): PersistentFeatureFlagsManager["listFlags"] {
    return getPlatformFeatureFlags().listFlags.bind(getPlatformFeatureFlags());
  },
  get setFlag(): PersistentFeatureFlagsManager["setFlag"] {
    return getPlatformFeatureFlags().setFlag.bind(getPlatformFeatureFlags());
  },
  get resetToDefault(): PersistentFeatureFlagsManager["resetToDefault"] {
    return getPlatformFeatureFlags().resetToDefault.bind(getPlatformFeatureFlags());
  },
  get toggleFlag(): PersistentFeatureFlagsManager["toggleFlag"] {
    return getPlatformFeatureFlags().toggleFlag.bind(getPlatformFeatureFlags());
  },
  get getAllFlagsSnapshot(): PersistentFeatureFlagsManager["getAllFlagsSnapshot"] {
    return getPlatformFeatureFlags().getAllFlagsSnapshot.bind(getPlatformFeatureFlags());
  },
  get getAdapter(): () => PersistentFeatureFlagsManager["getAdapter"] {
    return () => getPlatformFeatureFlags().getAdapter();
  },
} as unknown as PersistentFeatureFlagsManager;
