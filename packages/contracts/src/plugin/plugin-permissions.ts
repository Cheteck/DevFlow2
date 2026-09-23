/**
 * Plugin permissions — scoped to the target the plugin extends.
 */

import type { PermissionContract } from "../security/permission-contract";

export interface PluginPermissions {
  provides: PermissionContract[];
  requires: PermissionContract[];
}
