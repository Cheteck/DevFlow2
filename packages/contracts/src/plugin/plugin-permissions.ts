/**
 * Plugin permissions — scoped to the target the plugin extends.
 */

import type { PermissionContract } from "../security/permission-contract.js";

export interface PluginPermissions {
  provides: PermissionContract[];
  requires: PermissionContract[];
}
