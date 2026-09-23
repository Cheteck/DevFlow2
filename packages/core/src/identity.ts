/**
 * @mosaix/core — Explicit identities
 *
 * Every action in the ecosystem is attributable to a concrete identity:
 * an application (actor), a tenant (scope), and optionally a capability.
 * `ExecutionContext` is the canonical traceable unit passed to the audit
 * layer and to observability.
 */

import type { TenantIdentity } from "@mosaix/contracts";

export interface ApplicationIdentity {
  appId: string;
  version: string;
}

export interface CapabilityIdentity {
  id: string;
  version?: string;
  ownerApp?: string;
}

export interface ExecutionContext {
  actor: ApplicationIdentity;
  tenant: TenantIdentity;
  capability?: CapabilityIdentity;
  correlationId: string;
  timestamp: number;
}

export function createExecutionContext(
  actor: ApplicationIdentity,
  tenant: TenantIdentity,
  options: {
    capability?: CapabilityIdentity;
    correlationId?: string;
    timestamp?: number;
  } = {},
): ExecutionContext {
  return {
    actor,
    tenant,
    ...(options.capability !== undefined
      ? { capability: options.capability }
      : {}),
    correlationId: options.correlationId ?? `${actor.appId}:${Date.now()}`,
    timestamp: options.timestamp ?? Date.now(),
  };
}

export function describeTenant(tenant: TenantIdentity): string {
  return tenant.spaceId
    ? `${tenant.organizationId}:${tenant.spaceId}`
    : tenant.organizationId;
}
