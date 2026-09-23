/**
 * @mosaix/contracts — ApplicationDefinition
 * Canonical contract for first-class declarative platform compositions.
 */

export interface ContextRequirement {
  id: string;
  version: string; // e.g., "^1.0.0"
  optional?: boolean;
}

export interface CapabilityRequirement {
  id: string; // e.g. "commerce.orders"
  version?: string;
  requiredBy?: string;
}

export interface ApplicationDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  contexts: ContextRequirement[];
  capabilities: CapabilityRequirement[];
  policies?: Record<string, unknown>[];
  configuration?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ContextManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  requires?: ContextRequirement[];
  provides?: string[]; // capability IDs
  exposes?: {
    commands?: string[];
    events?: string[];
    queries?: string[];
  };
}

export interface TenantContextActivation {
  tenantId: string;
  applicationId: string;
  enabledContexts: string[];
  enabledCapabilities: string[];
  configOverrides?: Record<string, unknown>;
}
