/**
 * @mosaix/plugin-engine/core — Core Contracts, Manifests, Settings & Hooks
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

export type JSONSchemaType = "string" | "number" | "integer" | "boolean" | "object" | "array";

export interface JSONSchemaProperty {
  type: JSONSchemaType;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
}

export interface PluginSettingsSchema {
  $schema?: string;
  type: "object";
  title?: string;
  description?: string;
  required?: string[];
  properties: Record<string, JSONSchemaProperty>;
  additionalProperties?: boolean;
}

export interface PluginHookDeclaration {
  point: string;
  priority?: number;
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
  hooks?: PluginHookDeclaration[];
  settingsSchema?: PluginSettingsSchema;
  entrypoint: string;
  integrity?: string; // SHA-256 checksum
  signature?: string; // Cryptographic publisher signature
  publisher?: {
    id: string;
    name: string;
    publicKey?: string;
  };
  metadata?: {
    description?: string;
    author?: string;
    icon?: string;
    repository?: string;
    license?: string;
    tags?: string[];
  };
}

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
  manifest: PluginManifest;
  state: PluginState;
  instance?: unknown;
  context?: unknown;
  settings?: TSettings;
  error?: string;
  loadedAt?: string;
}
