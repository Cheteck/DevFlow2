import * as crypto from "node:crypto";
/**
 * @apps/spaces — Acting As Space Representation Engine & Outbox Event Emission (GAP-04 & P0 Feature Flag)
 */

import { featureAsync } from "@mosaix/sdk";

export interface ActingAsSpaceContext {
  realUserId: string;
  activeSpaceId: string;
  userRoleInSpace: string;
  actingAt: string;
}

export interface ActingAsAuditEvent {
  eventId: string;
  eventType: "spaces.acting_as.executed";
  context: ActingAsSpaceContext;
  actionExecuted: string;
  timestamp: string;
}

export class ActingAsSpaceEngine {
  private auditTrail: ActingAsAuditEvent[] = [];

  async executeActionAsSpace(
    realUserId: string,
    activeSpaceId: string,
    userRoleInSpace: string,
    actionName: string
  ): Promise<ActingAsAuditEvent> {
    // P0 Feature Flag Guard: spaces.acting_as.enforce_scopes (default: true)
    const enforceScopes = await featureAsync("spaces.acting_as.enforce_scopes", true);
    if (enforceScopes && userRoleInSpace === "restricted") {
      throw new Error(`Role [${userRoleInSpace}] is restricted from acting on behalf of space [${activeSpaceId}].`);
    }

    const auditEvent: ActingAsAuditEvent = {
      eventId: `evt-${crypto.randomUUID()}`,
      eventType: "spaces.acting_as.executed",
      context: {
        realUserId,
        activeSpaceId,
        userRoleInSpace,
        actingAt: new Date().toISOString(),
      },
      actionExecuted: actionName,
      timestamp: new Date().toISOString(),
    };

    this.auditTrail.push(auditEvent);
    return auditEvent;
  }

  getAuditTrail(): ActingAsAuditEvent[] {
    return this.auditTrail;
  }
}
