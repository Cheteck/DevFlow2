/**
 * Capability provider — the runtime surface an owner application exposes.
 */

import type { CapabilityContract } from "./capability-contract";

export interface CapabilityProvider {
  /** Id of the owning application. */
  applicationId: string;
  /** Capability ids provided by this application. */
  capabilities: string[];
  /** Declared capability contracts. */
  contracts: CapabilityContract[];
}
