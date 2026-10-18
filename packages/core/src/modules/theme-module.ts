/**
 * @mosaix/core — Theme module
 *
 * Installs the `ThemeRuntime` as the open `theme` extension service on the
 * KernelContext (escape hatch — a 7th service domain, NOT one of the 6
 * canonical services, which stay closed). Consumers reach the runtime via
 * `ctx.getService<ThemeRuntime>(THEME_SERVICE)`.
 *
 * This module is NOT part of `defaultModules()`: install it through
 * `KernelOptions.modules` (or `kernel.install`) where theming is required.
 * ADR-0002 — growth happens through modules, never by editing the kernel.
 */

import type { ThemeAssignmentsStore } from "@mosaix/contracts";
import {
  createThemeRuntime,
  InMemoryThemeAssignmentsStore,
  ThemeRuntime,
  ThemeTargetRegistry,
} from "@mosaix/theme";
import type { KernelContext, KernelModule } from "../kernel-module";

export const THEME_SERVICE = "theme" as const;

export interface ThemeModuleOptions {
  /** Pre-built runtime — when provided, `registry`/`store` are ignored. */
  readonly runtime?: ThemeRuntime;
  /** Target registry for the default runtime (defaults to an empty one). */
  readonly registry?: ThemeTargetRegistry;
  /** Assignment store for the default runtime (defaults to in-memory). */
  readonly store?: ThemeAssignmentsStore;
}

export class ThemeModule implements KernelModule {
  readonly name = "theme";
  readonly version = "1.0.0";
  readonly runtime: ThemeRuntime;

  constructor(options: ThemeModuleOptions = {}) {
    this.runtime =
      options.runtime ??
      createThemeRuntime({
        registry: options.registry ?? new ThemeTargetRegistry(),
        // eslint-disable-next-line no-restricted-syntax -- couche 2 : assignments de theme (defaut d'affichage), jamais de donnee metier. Injectable via `store` ou `runtime` pour un stockage durable au boot.
        store: options.store ?? new InMemoryThemeAssignmentsStore(),
      });
  }

  getRuntime(): ThemeRuntime {
    return this.runtime;
  }

  register(ctx: KernelContext): void {
    ctx.setService(THEME_SERVICE, this.runtime);
  }
}
