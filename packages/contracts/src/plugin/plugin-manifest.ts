/**
 * Plugin manifest — a plugin extends an existing capability.
 *
 * A plugin is NOT an application: it owns no business domain, cannot run
 * standalone, and always attaches to an existing extension point of a target.
 */

import type { MosaixArtifactManifest } from "../mosaix-artifact";
import type { PluginExtensionContract } from "./plugin-extension";

export interface PluginManifest extends MosaixArtifactManifest {
  type: "plugin";
  extension: PluginExtensionContract;
}
