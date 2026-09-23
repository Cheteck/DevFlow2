/**
 * @mosaix/core — Permissions module
 *
 * Provides the permission registry and the authorization engine.
 */

import { AuthorizationEngine, PermissionRegistry } from "../permission";
import type { KernelContext, KernelModule } from "../kernel-module";

export class PermissionsModule implements KernelModule {
  readonly name = "permissions";
  readonly version = "1.0.0";

  register(ctx: KernelContext): void {
    const registry = new PermissionRegistry();
    const engine = new AuthorizationEngine(registry);
    ctx.setService("permissions", registry);
    ctx.setService("authorization", engine);
  }
}
