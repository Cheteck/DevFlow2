/**
 * Capability contract — the most important contract in MosaiX.
 *
 * Applications never depend directly on other applications. They consume
 * capabilities. A capability declares a provider, an id, a version and a set
 * of typed operations.
 */

export interface CapabilityOperation {
  name: string;
  /** Id of the input schema (contract reference). */
  input: string;
  /** Id of the output schema (contract reference). */
  output: string;
  /** Optional timeout in milliseconds. */
  timeoutMs?: number;
}

export interface CapabilityContract {
  id: string;
  version: string;
  provider: {
    applicationId: string;
  };
  operations: CapabilityOperation[];
}
