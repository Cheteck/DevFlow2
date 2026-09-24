/**
 * @mosaix/plugin-engine/management — Plugin CLI Command Runner
 */

import type { PluginEngine } from "../runtime/index.js";
import type { PluginMarketplaceRegistry } from "./marketplace-registry.js";
import type { WorkspacePluginLoader } from "../adapters/workspace-loader.js";

export interface CliCommandResult {
  code: number;
  message: string;
  data?: unknown;
}

export class PluginCliCommandRunner {
  constructor(
    private readonly engine: PluginEngine,
    private readonly marketplace?: PluginMarketplaceRegistry,
    private readonly workspaceLoader?: WorkspacePluginLoader
  ) {}

  /**
   * mosaix plugin install <packageId>[@version]
   */
  async install(pkgSpec: string): Promise<CliCommandResult> {
    if (!this.marketplace) {
      return { code: 1, message: "Error: No marketplace registry configured." };
    }

    const [packageId, versionRange = "latest"] = pkgSpec.split("@");
    const resolved = this.marketplace.resolveVersion(packageId, versionRange);
    if (!resolved) {
      return { code: 1, message: `Error: Package [${packageId}] with version [${versionRange}] not found in marketplace.` };
    }

    try {
      await this.engine.registerAndActivate(resolved.manifest);
      return {
        code: 0,
        message: `✔ Successfully installed plugin [${resolved.manifest.name}] v${resolved.version} (${resolved.manifest.id}).`,
        data: resolved.manifest,
      };
    } catch (err) {
      return {
        code: 1,
        message: `Failed to install plugin [${packageId}]: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * mosaix plugin update <packageId>
   */
  async update(packageId: string): Promise<CliCommandResult> {
    const existing = this.engine.registry.get(packageId);
    if (!existing) {
      return { code: 1, message: `Error: Plugin [${packageId}] is not currently installed.` };
    }

    if (!this.marketplace) {
      return { code: 1, message: "Error: No marketplace registry configured." };
    }

    const latest = this.marketplace.resolveVersion(packageId, "latest");
    if (!latest) {
      return { code: 1, message: `Error: Plugin [${packageId}] not found in marketplace.` };
    }

    if (latest.version === existing.manifest.version) {
      return { code: 0, message: `Plugin [${packageId}] is already up to date (v${latest.version}).` };
    }

    await this.engine.lifecycle.unload(packageId);
    await this.engine.registerAndActivate(latest.manifest);

    return {
      code: 0,
      message: `✔ Successfully updated plugin [${packageId}] from v${existing.manifest.version} to v${latest.version}.`,
      data: latest.manifest,
    };
  }

  /**
   * mosaix plugin remove <packageId>
   */
  async remove(packageId: string): Promise<CliCommandResult> {
    if (!this.engine.registry.has(packageId)) {
      return { code: 1, message: `Error: Plugin [${packageId}] is not installed.` };
    }

    await this.engine.lifecycle.unload(packageId);
    return { code: 0, message: `✔ Successfully removed plugin [${packageId}].` };
  }

  /**
   * mosaix plugin list
   */
  list(): CliCommandResult {
    const plugins = this.engine.registry.list().map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      targetAppId: p.manifest.targetAppId,
      state: p.state,
      loadedAt: p.loadedAt,
    }));

    return {
      code: 0,
      message: `Installed plugins (${plugins.length}):`,
      data: plugins,
    };
  }

  /**
   * mosaix plugin dev <pluginPath>
   */
  async dev(_pluginPath: string): Promise<CliCommandResult> {
    if (!this.workspaceLoader) {
      return { code: 1, message: "Error: No workspace loader configured." };
    }

    const discovered = await this.workspaceLoader.scanWorkspace();
    return {
      code: 0,
      message: `✔ Started dev mode on workspace. Discovered ${discovered.length} plugin(s). File watching active.`,
      data: discovered,
    };
  }
}
