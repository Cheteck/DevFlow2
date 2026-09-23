/**
 * Application permissions — the contract surface of an application.
 *
 *   provides → what THIS application grants to others
 *   requires → what THIS application needs from others
 *
 * The Control Plane validates at deploy time that every `requires` matches a
 * `provides` with a granted permission; the Runtime enforces every call.
 */

import type { PermissionContract } from "../security/permission-contract";

export interface ApplicationPermissions {
  provides: PermissionContract[];
  requires: PermissionContract[];
}
