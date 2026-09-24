/**
 * @mosaix/core — Built-in modules
 *
 * The kernel installs these by default. Consumers can supply their own module
 * set (e.g. production storage, OpenTelemetry) to replace behavior without
 * modifying the kernel.
 */

import { CapabilitiesModule } from "./capabilities-module.js";
import { EventsModule } from "./events-module.js";
import { PermissionsModule } from "./permissions-module.js";
import type { KernelModule } from "../kernel-module.js";

export { CapabilitiesModule } from "./capabilities-module.js";
export { EventsModule } from "./events-module.js";
export { PermissionsModule } from "./permissions-module.js";
export { ObservabilityModule } from "./observability-module.js";
export type { ObservabilityModuleOptions } from "./observability-module.js";
export { PluginModule, PLUGIN_SERVICE } from "./plugin-module.js";
export { MaintenanceModule, MaintenanceService, maintenanceService, MAINTENANCE_SERVICE, type MaintenanceStatus } from "./maintenance-module.js";
export { InfrastructureModule } from "./infrastructure-module.js";
export type { InfrastructureModuleOptions } from "./infrastructure-module.js";
export { DatabaseModule } from "./database-module.js";
export type { DatabaseModuleOptions, DatabaseService } from "./database-module.js";

export function defaultModules(): KernelModule[] {
  return [
    new PermissionsModule(),
    new CapabilitiesModule(),
    new EventsModule(),
  ];
}
