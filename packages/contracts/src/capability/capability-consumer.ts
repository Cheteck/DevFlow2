/**
 * Capability consumer — the runtime surface an application uses.
 */

export interface CapabilityConsumer {
  /** Id of the consuming application. */
  applicationId: string;
  /** Capability ids consumed by this application. */
  requires: string[];
  /** Declared queries the application depends on. */
  queries?: string[];
}
