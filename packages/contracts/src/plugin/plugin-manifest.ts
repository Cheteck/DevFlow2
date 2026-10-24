/**
 * Plugin manifest — a plugin extends an existing capability.
 *
 * A plugin is NOT an application: it owns no business domain, cannot run
 * standalone, and always attaches to an existing extension point of a target.
 */

import type { MosaixArtifactManifest } from "../mosaix-artifact.js";
import type { PluginExtensionContract } from "./plugin-extension.js";

export interface SlotContribution {
  slot: string;
  entrypoint?: string;
  order?: number;
}

export interface PluginPermission {
  name: string;
  description?: string;
}

export interface PluginHookDeclaration {
  point: string;
  priority?: number;
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
  properties?: Record<string, JSONSchemaProperty>;
  additionalProperties?: boolean;
}

export interface PluginPublisher {
  id: string;
  name: string;
  publicKey?: string;
}

export interface PluginManifest extends MosaixArtifactManifest {
  type?: "plugin";
  /** Target application ID being extended (alias for extension.target). */
  targetAppId?: string;
  extension: PluginExtensionContract;
  requiresCapabilities?: string[];
  permissions?: PluginPermission[];
  slotContributions?: SlotContribution[];
  hooks?: PluginHookDeclaration[] | string[];
  settingsSchema?: PluginSettingsSchema;
  entrypoint?: string;
  integrity?: string; // SHA-256 checksum
  signature?: string; // Cryptographic publisher signature
  publisher?: PluginPublisher;
  metadata?: {
    description?: string;
    author?: string;
    icon?: string;
    repository?: string;
    license?: string;
    tags?: string[];
  };
}
