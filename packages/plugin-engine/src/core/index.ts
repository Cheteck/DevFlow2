/**
 * @mosaix/plugin-engine/core — Core Contracts & Manifests
 */

export interface SlotContribution {
  slot: string;
  entrypoint?: string;
  order?: number;
}

export interface PluginPermission {
  name: string;
  description?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  targetAppId: string;
  requiresCapabilities?: string[];
  permissions?: PluginPermission[];
  slotContributions?: SlotContribution[];
  entrypoint: string;
  metadata?: {
    description?: string;
    author?: string;
    icon?: string;
  };
}

export type PluginState =
  | "DISCOVERED"
  | "VALIDATED"
  | "LOADED"
  | "INITIALIZED"
  | "ACTIVE"
  | "DISABLED"
  | "UNLOADED";

export interface PluginDefinition {
  manifest: PluginManifest;
  state: PluginState;
  instance?: unknown;
  context?: unknown;
  error?: string;
}
