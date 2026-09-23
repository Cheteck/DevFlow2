/**
 * Permission contract — the grammar that governs every runtime interaction.
 *
 * Grammar: `domain:resource:action:scope`
 *   domain   = Bounded Context id (e.g. sales, inventory, identity)
 *   resource = entity | capability | event
 *   action   = create, read, update, delete, execute, publish, consume
 *   scope    = tenant | organization | store | self
 */

import type { PermissionString } from "@mosaix/types";

export type PermissionScope = "tenant" | "organization" | "store" | "self";

export type PermissionCategory = "entity" | "capability" | "event" | "query";

export interface PermissionContract {
  /** Canonical permission string: `domain:resource:action:scope`. */
  permission: PermissionString;
  category: PermissionCategory;
  scope: PermissionScope;
  /** Human-readable purpose (used for audit and marketplace review). */
  description?: string;
  /** Wildcards allowed only on domain, resource, or action segments. */
  wildcard?: boolean;
}
