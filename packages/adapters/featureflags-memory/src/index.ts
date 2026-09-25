import {
  type FeatureFlagsPort,
  type FeatureFlagUserContext,
  type FeatureFlagDefinition,
  FEATURE_FLAG_CATALOG,
} from "@mosaix/ports-feature-flags";

export interface MemoryFeatureFlagRecord {
  key: string;
  value: string | boolean;
  description?: string;
  category?: string;
  variationType: "boolean" | "string";
  rolesAllowlist?: string[];
  tenantAllowlist?: string[];
}

export interface FeatureFlagAuditRecord {
  timestamp: string;
  flagKey: string;
  action: "set" | "override";
  oldValue?: string | boolean;
  newValue: string | boolean;
}

export class MemoryFeatureFlagsAdapter implements FeatureFlagsPort {
  private readonly flags = new Map<string, MemoryFeatureFlagRecord>();
  private readonly auditLogs: FeatureFlagAuditRecord[] = [];

  constructor(
    initialFlags?: Record<
      string,
      string | boolean | Partial<MemoryFeatureFlagRecord>
    >,
  ) {
    // 1. Seed from central FEATURE_FLAG_CATALOG
    for (const [key, def] of Object.entries(FEATURE_FLAG_CATALOG)) {
      this.flags.set(key, {
        key,
        value: def.defaultValue,
        description: def.description,
        category: def.category || "general",
        variationType: (def.variationType as "boolean" | "string") || "boolean",
      });
    }

    // 2. Apply user-supplied overrides
    if (initialFlags) {
      for (const [key, val] of Object.entries(initialFlags)) {
        if (typeof val === "boolean" || typeof val === "string") {
          this.setFlag(key, val);
        } else if (typeof val === "object" && val !== null) {
          const flagVal = val.value ?? true;
          this.flags.set(key, {
            key,
            value: flagVal,
            description: val.description,
            category: val.category || key.split(".")[0] || "general",
            variationType: typeof flagVal === "boolean" ? "boolean" : "string",
            rolesAllowlist: val.rolesAllowlist,
            tenantAllowlist: val.tenantAllowlist,
          });
        }
      }
    }
  }

  async isEnabled(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue = false,
  ): Promise<boolean> {
    const record = this.flags.get(flagKey);
    if (!record) return defaultValue;

    // Evaluate context restrictions if present
    if (record.rolesAllowlist && record.rolesAllowlist.length > 0) {
      if (
        !context?.roles ||
        !context.roles.some((r) => record.rolesAllowlist!.includes(r))
      ) {
        return false;
      }
    }

    if (record.tenantAllowlist && record.tenantAllowlist.length > 0) {
      if (
        !context?.tenantId ||
        !record.tenantAllowlist.includes(context.tenantId)
      ) {
        return false;
      }
    }

    if (typeof record.value === "boolean") return record.value;
    return defaultValue;
  }

  async getVariation(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue = "",
  ): Promise<string> {
    const record = this.flags.get(flagKey);
    if (!record) return defaultValue;

    if (record.rolesAllowlist && record.rolesAllowlist.length > 0) {
      if (
        !context?.roles ||
        !context.roles.some((r) => record.rolesAllowlist!.includes(r))
      ) {
        return defaultValue;
      }
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
      tenantAllowlist?: string[];
    },
  ): void {
    const existing = this.flags.get(flagKey);
    this.auditLogs.push({
      timestamp: new Date().toISOString(),
      flagKey,
      action: existing ? "override" : "set",
      oldValue: existing?.value,
      newValue: value,
    });
    this.flags.set(flagKey, {
      key: flagKey,
      value,
      description:
        description ?? existing?.description ?? `Feature flag ${flagKey}`,
      category:
        options?.category ??
        existing?.category ??
        flagKey.split(".")[0] ??
        "general",
      variationType: typeof value === "boolean" ? "boolean" : "string",
      rolesAllowlist: options?.rolesAllowlist ?? existing?.rolesAllowlist,
      tenantAllowlist: options?.tenantAllowlist ?? existing?.tenantAllowlist,
    });
  }

  getAuditLogs(): readonly FeatureFlagAuditRecord[] {
    return this.auditLogs;
  }

  /**
   * Synchronous boolean read for SSR render paths. Only meaningful for
   * in-memory adapters — remote providers should not implement this.
   */
  isEnabledSync(flagKey: string, defaultValue = false): boolean {
    const record = this.flags.get(flagKey);
    if (!record) return defaultValue;
    if (typeof record.value === "boolean") return record.value;
    return defaultValue;
  }

  async listFlags(): Promise<FeatureFlagDefinition[]> {
    return Array.from(this.flags.values()).map((f) => ({
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
    for (const [key, record] of this.flags.entries()) {
      if (typeof record.value === "boolean") {
        snapshot[key] = await this.isEnabled(key, context, record.value);
      } else {
        snapshot[key] = await this.getVariation(key, context, record.value);
      }
    }
    return snapshot;
  }

  clear(): void {
    this.flags.clear();
  }
}
