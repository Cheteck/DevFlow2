export type PermissionString = string;

export interface TenantIdentity {
  organizationId: string;
  spaceId?: string;
  tenantId?: string;
}

export type AppStatus =
  | "discovered"
  | "registered"
  | "initializing"
  | "ready"
  | "active"
  | "degraded"
  | "draining"
  | "disabled"
  | "failed";

export type EventSource = string | { application: string; instance?: string; };
export type EventMetadata = Record<string, unknown>;
export type EventSecurity = Record<string, unknown>;
export type EventClassification = "public" | "internal" | "restricted" | string;

export interface MosaixEventEnvelope<T = unknown> {
  id: string;
  type: string;
  version: string;
  source: EventSource;
  timestamp: string;
  payload: T;
  tenant?: string | TenantIdentity;
  correlationId?: string;
  causationId?: string;
  metadata?: EventMetadata;
  security?: EventSecurity;
}

export interface ParsedPermission {
  domain: string;
  resource: string;
  action: string;
  scope: string;
}

export function parsePermission(permission: string): ParsedPermission | null {
  if (typeof permission !== "string") return null;
  const segments = permission.split(":");
  if (segments.length !== 4) return null;

  const validScopes = ["tenant", "organization", "store", "self", "space"];
  const [domain, resource, action, scope] = segments;

  if (!domain || !resource || !action || !scope) return null;
  if (!validScopes.includes(scope) && scope !== "*") return null;

  return {
    domain,
    resource,
    action,
    scope,
  };
}

export function uuidV7(): string {
  const now = Date.now();
  const timeHex = now.toString(16).padStart(12, "0");

  const rand1 = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, "0");
  const rand2 = Math.floor(Math.random() * 0x40000000).toString(16).padStart(8, "0");
  const rand3 = Math.floor(Math.random() * 0x40000000).toString(16).padStart(8, "0");

  const ver = "7";
  const variantChars = ["8", "9", "a", "b"];
  const varChar = variantChars[Math.floor(Math.random() * 4)];

  const part1 = timeHex.slice(0, 8);
  const part2 = timeHex.slice(8, 12);
  const part3 = ver + rand1;
  const part4 = varChar + rand2.slice(0, 3);
  const part5 = rand2.slice(3, 8) + rand3.slice(0, 7);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export const generateUuidV7 = uuidV7;
export const uuid = uuidV7;
