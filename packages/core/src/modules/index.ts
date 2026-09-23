/**
 * @mosaix/core — Built-in modules
 *
 * The kernel installs these by default. Consumers can supply their own module
 * set (e.g. production storage, OpenTelemetry) to replace behavior without
 * modifying the kernel.
 */

import { CapabilitiesModule } from "./capabilities-module";
import { EventsModule } from "./events-module";
import { PermissionsModule } from "./permissions-module";
import type { KernelModule } from "../kernel-module";

export { CapabilitiesModule } from "./capabilities-module";
export { EventsModule } from "./events-module";
export { PermissionsModule } from "./permissions-module";
export { ObservabilityModule } from "./observability-module";
export type { ObservabilityModuleOptions } from "./observability-module";
export { PluginModule } from "./plugin-module";
export { PLUGIN_SERVICE } from "./plugin-module";
export { InfrastructureModule } from "./infrastructure-module";
export type { InfrastructureModuleOptions } from "./infrastructure-module";
export { DatabaseModule } from "./database-module";
export type { DatabaseModuleOptions, DatabaseService } from "./database-module";

export function defaultModules(): KernelModule[] {
  return [
    new PermissionsModule(),
    new CapabilitiesModule(),
    new EventsModule(),
  ];
}
