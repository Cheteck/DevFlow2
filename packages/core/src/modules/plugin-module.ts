/**
 * @mosaix/core — Plugin module (T-EXT-04)
 *
 * Installs the `PluginRegistry` as the open `plugins` extension service on the
 * KernelContext (escape hatch T-EXT-01 — a 7th service domain, NOT one of the
 * 6 canonical services, which stay closed). Consumers reach the registry via
 * `ctx.getService<PluginRegistry>("plugins")`.
 *
 * This module is NOT part of `defaultModules()`: install it through
 * `KernelOptions.modules` (or `kernel.install`) where plugin hosting is
 * required. ADR-0002 — growth happens through modules, never by editing the
 * kernel.
 */

import type { KernelContext, KernelModule } from "../kernel-module";
import { PluginRegistry } from "../plugin/plugin-registry";

export const PLUGIN_SERVICE = "plugins" as const;

export class PluginModule implements KernelModule {
  readonly name = "plugin";
  readonly version = "1.0.0";
  readonly registry: PluginRegistry;

  constructor(registry: PluginRegistry = new PluginRegistry()) {
    this.registry = registry;
  }

  register(ctx: KernelContext): void {
    ctx.setService(PLUGIN_SERVICE, this.registry);
  }
}
