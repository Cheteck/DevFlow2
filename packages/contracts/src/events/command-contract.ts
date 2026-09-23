/**
 * Command contract — CQRS write side.
 *
 * A command is an intent; an event is a fact. Commands are dispatched to the
 * owning application's command handler and may publish one or more events.
 */

import type { PermissionString } from "@mosaix/types";

export interface CommandContract {
  id: string;
  version: string;
  /** Id of the input schema (contract reference). */
  input: string;
  /** Id of the output schema (contract reference). */
  output: string;
  /** Owning application id. */
  ownerApplication: string;
  /** Required permission to execute the command. */
  requiresPermission: PermissionString;
  /** Whether the command is idempotent (safe to retry). */
  idempotent: boolean;
}
