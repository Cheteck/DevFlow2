/**
 * Query contract — CQRS read side.
 *
 * A query is a read-only resolution against the owning application's query
 * handler. Authorization is enforced at the kernel level.
 */

import type { PermissionString } from "@mosaix/types";

export interface QueryContract {
  id: string;
  version: string;
  /** Id of the input schema (contract reference). */
  input: string;
  /** Id of the output schema (contract reference). */
  output: string;
  /** Owning application id. */
  ownerApplication: string;
  /** Required permission to execute the query. */
  requiresPermission: PermissionString;
}
