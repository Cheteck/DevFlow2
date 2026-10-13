/**
 * @mosaix/plugin-engine/core — Core Contracts, Manifests, Settings & Hooks
 */

export type {
  PluginManifest,
  SlotContribution,
  PluginPermission,
  PluginHookDeclaration,
  JSONSchemaType,
  JSONSchemaProperty,
  PluginSettingsSchema,
  PluginPublisher,
} from "@mosaix/contracts";

export type PluginState =
  | "DISCOVERED"
  | "VALIDATED"
  | "LOADED"
  | "INITIALIZED"
  | "ACTIVE"
  | "DISABLED"
  | "UNLOADED"
  | "ERROR";

export interface PluginDefinition<TSettings = Record<string, unknown>> {
  manifest: import("@mosaix/contracts").PluginManifest;
  state: PluginState;
  instance?: unknown;
  context?: unknown;
  settings?: TSettings;
  error?: string;
  loadedAt?: string;
}
