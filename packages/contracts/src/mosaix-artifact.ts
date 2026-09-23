/**
 * Mosaix Artifact — the root concept of the ecosystem.
 *
 * The Runtime does not know about "React apps", "npm plugins" or "bundles".
 * It knows about **Mosaix Artifacts**: governed, versioned, signed units that
 * declare what they provide, require, and how they integrate.
 *
 * Every concrete artifact (application, plugin, theme) extends this root.
 */

import type { CapabilityContract } from "./capability/capability-contract";
import type { PermissionContract } from "./security/permission-contract";
import type { ArtifactSignature } from "./security/signature";

export type MosaixArtifactType = "application" | "plugin" | "theme";

export interface ArtifactMetadata {
  /** Human-readable artifact name. */
  name: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  tags?: string[];
}

export interface ArtifactDependency {
  /** Id of the referenced artifact or capability. */
  id: string;
  /** SemVer range or exact version. */
  version: string;
  kind: "capability" | "event" | "plugin" | "theme";
}

export interface MosaixArtifactManifest {
  id: string;
  name: string;
  version: string;
  type: MosaixArtifactType;
  metadata?: ArtifactMetadata;
  capabilities?: CapabilityContract[] | Array<{ id: string; version: string }>;
  permissions?: PermissionContract[] | string[];
  dependencies?: ArtifactDependency[];
  /** Trust level (1..5). See `security/trust-level.ts`. */
  trustLevel?: number;
  signature?: ArtifactSignature;
}
