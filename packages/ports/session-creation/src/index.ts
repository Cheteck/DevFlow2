/**
 * @mosaix/ports-session-creation — Session creation port for MosaiX authentication.
 */

import type { Session } from "@mosaix/contracts";

export interface SessionCreationPort {
  createSession(
    identityId: string,
    tenantId: string,
    attributes?: Record<string, unknown>,
  ): Promise<Session>;
}
