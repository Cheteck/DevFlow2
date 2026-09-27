import type { DatabasePort } from "@mosaix/ports-database";
import type {
  FeatureFlagsPort,
  FeatureFlagUserContext,
  FeatureFlagDefinition,
} from "@mosaix/ports-feature-flags";
import { FEATURE_FLAG_CATALOG } from "@mosaix/ports-feature-flags";

export interface PostgresFeatureFlagRecord {
  key: string;
  value: string | boolean;
  description?: string;
  category?: string;
  variationType: "boolean" | "string";
  rolesAllowlist?: string[];
  usersAllowlist?: string[];
  tenantsAllowlist?: string[];
  plansAllowlist?: string[];
  percentageRollout?: number;
}

export interface PostgresFeatureFlagsAdapterOptions {
  tableName?: string;
}

export class PostgresFeatureFlagsAdapter implements FeatureFlagsPort {
  private readonly table: string;
  private cache = new Map<string, PostgresFeatureFlagRecord>();

  constructor(
    private readonly db: DatabasePort,
    private readonly options: PostgresFeatureFlagsAdapterOptions = {},
  ) {
    this.table = options.tableName ?? "feature_flags";
  }

  private rowToRecord(row: Record<string, unknown>): PostgresFeatureFlagRecord {
    const rawValue = row["value"];
    let value: string | boolean;
    if (typeof rawValue === "string") {
      if (rawValue === "true") value = true;
      else if (rawValue === "false") value = false;
      else value = rawValue;
    } else if (typeof rawValue === "boolean") {
      value = rawValue;
    } else {
      value = String(rawValue);
    }

    return {
      key: String(row["key"]),
      value,
      description: row["description"] ? String(row["description"]) : undefined,
      category: row["category"] ? String(row["category"]) : "general",
      variationType: (row["variation_type"] as "boolean" | "string") || "boolean",
      rolesAllowlist: row["roles_allowlist"] ? JSON.parse(String(row["roles_allowlist"])) : undefined,
      usersAllowlist: row["users_allowlist"] ? JSON.parse(String(row["users_allowlist"])) : undefined,
      tenantsAllowlist: row["tenants_allowlist"] ? JSON.parse(String(row["tenants_allowlist"])) : undefined,
      plansAllowlist: row["plans_allowlist"] ? JSON.parse(String(row["plans_allowlist"])) : undefined,
      percentageRollout: row["percentage_rollout"] ? Number(row["percentage_rollout"]) : undefined,
    };
  }

  async init(): Promise<void> {
    // Create table if not exists
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS "${this.table}" (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'general',
        variation_type TEXT DEFAULT 'boolean',
        roles_allowlist TEXT,
        users_allowlist TEXT,
        tenants_allowlist TEXT,
        plans_allowlist TEXT,
        percentage_rollout INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Load initial catalog
    for (const [key, def] of Object.entries(FEATURE_FLAG_CATALOG)) {
      const existing = await this.db.query<Record<string, unknown>>(
        `SELECT * FROM "${this.table}" WHERE key = ?`,
        [key],
      );
      if (existing.length === 0) {
        const defaultValue = def.defaultValue ?? false;
        await this.setFlag(key, defaultValue, def.description, {
          category: def.category || "general",
          rolesAllowlist: def.rolesAllowlist,
        });
      }
    }

    // Load all flags into cache
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT key, value, description, category, variation_type, roles_allowlist, users_allowlist, tenants_allowlist, plans_allowlist, percentage_rollout FROM "${this.table}"`,
    );
    for (const row of rows) {
      const record = this.rowToRecord(row);
      this.cache.set(record.key, record);
    }
  }

  private evaluateContextRestrictions(
    record: PostgresFeatureFlagRecord,
    context?: FeatureFlagUserContext,
  ): boolean {
    if (record.rolesAllowlist && record.rolesAllowlist.length > 0) {
      if (
        !context?.roles ||
        !context.roles.some((r) => record.rolesAllowlist!.includes(r))
      ) {
        return false;
      }
    }

    if (record.usersAllowlist && record.usersAllowlist.length > 0) {
      if (
        !context?.userId ||
        !record.usersAllowlist.includes(context.userId)
      ) {
        return false;
      }
    }

    if (record.tenantsAllowlist && record.tenantsAllowlist.length > 0) {
      if (
        !context?.tenantId ||
        !record.tenantsAllowlist.includes(context.tenantId)
      ) {
        return false;
      }
    }

    if (record.plansAllowlist && record.plansAllowlist.length > 0) {
      const customPlan = context.custom?.subscriptionPlan;
      const userPlan =
        context.subscriptionPlan ??
        (typeof customPlan === "string" ? customPlan : undefined);
      if (!userPlan || !record.plansAllowlist.includes(userPlan)) {
        return false;
      }
    }

    if (
      typeof record.percentageRollout === "number" &&
      record.percentageRollout >= 0 &&
      record.percentageRollout < 100
    ) {
      if (context?.userId) {
        let hash = 0;
        for (let i = 0; i < context.userId.length; i++) {
          hash = (hash << 5) - hash + context.userId.charCodeAt(i);
          hash |= 0;
        }
        const userPercent = Math.abs(hash) % 100;
        if (userPercent >= record.percentageRollout) {
          return false;
        }
      } else {
        return false;
      }
    }

    return true;
  }

  async isEnabled(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue = false,
  ): Promise<boolean> {
    const record = this.cache.get(flagKey);
    if (!record) return defaultValue;

    if (!this.evaluateContextRestrictions(record, context)) {
      return false;
    }

    if (typeof record.value === "boolean") return record.value;
    return defaultValue;
  }

  async getVariation(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue = "",
  ): Promise<string> {
    const record = this.cache.get(flagKey);
    if (!record) return defaultValue;

    if (!this.evaluateContextRestrictions(record, context)) {
      return defaultValue;
    }

    if (typeof record.value === "string") return record.value;
    return defaultValue;
  }

  setFlag(
    flagKey: string,
    value: string | boolean,
    description?: string,
    options?: {
      category?: string;
      rolesAllowlist?: string[];
      usersAllowlist?: string[];
      tenantsAllowlist?: string[];
      plansAllowlist?: string[];
      percentageRollout?: number;
    },
  ): void {
    const existing = this.cache.get(flagKey);
    const valueStr = typeof value === "boolean" ? (value ? "true" : "false") : value;

    this.cache.set(flagKey, {
      key: flagKey,
      value,
      description: description ?? existing?.description ?? `Feature flag ${flagKey}`,
      category: options?.category ?? existing?.category ?? flagKey.split(".")[0] ?? "general",
      variationType: typeof value === "boolean" ? "boolean" : "string",
      rolesAllowlist: options?.rolesAllowlist ?? existing?.rolesAllowlist,
      usersAllowlist: options?.usersAllowlist ?? existing?.usersAllowlist,
      tenantsAllowlist: options?.tenantsAllowlist ?? existing?.tenantsAllowlist,
      plansAllowlist: options?.plansAllowlist ?? existing?.plansAllowlist,
      percentageRollout: options?.percentageRollout ?? existing?.percentageRollout,
    });

    // Persist to database asynchronously
    void this.persistFlag(flagKey, valueStr, description, options);
  }

  private async persistFlag(
    flagKey: string,
    valueStr: string,
    description?: string,
    options?: {
      category?: string;
      rolesAllowlist?: string[];
      usersAllowlist?: string[];
      tenantsAllowlist?: string[];
      plansAllowlist?: string[];
      percentageRollout?: number;
    },
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO "${this.table}" (key, value, description, category, variation_type, roles_allowlist, users_allowlist, tenants_allowlist, plans_allowlist, percentage_rollout, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         description = excluded.description,
         category = excluded.category,
         variation_type = excluded.variation_type,
         roles_allowlist = excluded.roles_allowlist,
         users_allowlist = excluded.users_allowlist,
         tenants_allowlist = excluded.tenants_allowlist,
         plans_allowlist = excluded.plans_allowlist,
         percentage_rollout = excluded.percentage_rollout,
         updated_at = excluded.updated_at`,
    [
      flagKey,
      valueStr,
      description ?? `Feature flag ${flagKey}`,
      options?.category ?? flagKey.split(".")[0] ?? "general",
      typeof valueStr === "boolean" ? "boolean" : "string",
      options?.rolesAllowlist ? JSON.stringify(options.rolesAllowlist) : null,
      options?.usersAllowlist ? JSON.stringify(options.usersAllowlist) : null,
      options?.tenantsAllowlist ? JSON.stringify(options.tenantsAllowlist) : null,
      options?.plansAllowlist ? JSON.stringify(options.plansAllowlist) : null,
      options?.percentageRollout ?? null,
      now,
    ]);
  }

  async listFlags(): Promise<FeatureFlagDefinition[]> {
    return Array.from(this.cache.values()).map((f) => ({
      key: f.key,
      description: f.description,
      defaultValue: f.value,
      enabled: typeof f.value === "boolean" ? f.value : true,
      variationType: f.variationType,
      category: f.category,
    }));
  }

  async getAllFlagsSnapshot(
    context?: FeatureFlagUserContext,
  ): Promise<Record<string, boolean | string>> {
    const snapshot: Record<string, boolean | string> = {};
    for (const [key, record] of this.cache.entries()) {
      if (typeof record.value === "boolean") {
        snapshot[key] = await this.isEnabled(key, context, record.value);
      } else {
        snapshot[key] = await this.getVariation(key, context, record.value);
      }
    }
    return snapshot;
  }

  clear(): void {
    this.cache.clear();
  }
}