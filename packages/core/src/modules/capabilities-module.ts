/**
 * @mosaix/core — Capabilities module
 *
 * Provides the capability registry (versioning, availability, discovery).
 */

import { CapabilityRegistry } from "../capability-registry";
import type { KernelContext, KernelModule } from "../kernel-module";

export class CapabilitiesModule implements KernelModule {
  readonly name = "capabilities";
  readonly version = "1.0.0";

  register(ctx: KernelContext): void {
    ctx.setService("capabilities", new CapabilityRegistry());
  }
}
