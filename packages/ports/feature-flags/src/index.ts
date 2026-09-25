export interface FeatureFlagDefinition {
  key: string;
  description?: string;
  defaultValue: boolean | string;
  variationType?: "boolean" | "string" | "json";
  category?: string;
  enabled?: boolean;
}

export interface FeatureFlagUserContext {
  key: string;
  userId?: string;
  email?: string;
  roles?: string[];
  tenantId?: string;
  subscriptionPlan?: string;
  custom?: Record<string, string | number | boolean>;
}

/**
 * FeatureFlagsPort — Decouples application toggles from LaunchDarkly, Split, Unleash, etc.
 */
export interface FeatureFlagsPort {
  /** Asynchronously evaluates a boolean feature flag. */
  isEnabled(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue?: boolean,
  ): Promise<boolean>;
  /** Asynchronously evaluates a variation string feature flag. */
  getVariation(
    flagKey: string,
    context?: FeatureFlagUserContext,
    defaultValue?: string,
  ): Promise<string>;
  /** Optional: lists registered or discovered feature flags. */
  listFlags?(): Promise<FeatureFlagDefinition[]>;
  /** Optional: updates/overrides a flag at runtime. */
  setFlag?(
    flagKey: string,
    value: boolean | string,
    description?: string,
  ): Promise<void> | void;
  /** Optional: synchronous boolean read for render paths (memory adapters). */
  isEnabledSync?(flagKey: string, defaultValue?: boolean): boolean;
  /** Optional: returns a snapshot of all flags for client-side hydration. */
  getAllFlagsSnapshot?(
    context?: FeatureFlagUserContext,
  ): Promise<Record<string, boolean | string>>;
}

export * from "./catalog.js";
