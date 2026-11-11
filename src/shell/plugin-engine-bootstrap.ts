/**
 * Global PluginEngine bootstrap singleton for the MosaiX Shell.
 */

import { PluginEngine } from "@mosaix/plugin-engine";

let globalEngineInstance: PluginEngine | null = null;

export function getGlobalPluginEngine(): PluginEngine {
  if (!globalEngineInstance) {
    globalEngineInstance = new PluginEngine();
  }
  return globalEngineInstance;
}

export function resetGlobalPluginEngine(): void {
  globalEngineInstance = null;
}
