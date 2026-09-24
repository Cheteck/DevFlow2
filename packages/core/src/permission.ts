import type { PermissionString, TenantIdentity } from "@mosaix/types";
import { parsePermission } from "@mosaix/types";

type PermissionMatch = "deny" | "allow" | "wildcard" | "none";

interface PermissionEntry {
  permission: PermissionString;
  tenant: TenantIdentity;
  grantedTo: string;
  explicit: boolean;
}

export interface RegisteredPermissionDefinition {
  key: PermissionString;
  description: string;
  scopes: string[];
  assignableBy?: string[];
  metadata?: Record<string, unknown>;
}

function matchSegments(request: string[], entry: string[]): boolean {
  if (request.length !== entry.length) return false;
  return request.every((seg, i) => entry[i] === "*" || seg === "*" || entry[i] === seg);
}

export class PermissionRegistry {
  private readonly entries: PermissionEntry[] = [];
  private readonly registeredDefinitions = new Map<string, RegisteredPermissionDefinition>();

  public registerPermission(def: RegisteredPermissionDefinition): void {
    this.assertRegistered(def.key);
    this.registeredDefinitions.set(def.key, def);
  }

  public isRegistered(key: string): boolean {
    return this.registeredDefinitions.has(key);
  }

  public getRegistered(key: string): RegisteredPermissionDefinition | undefined {
    return this.registeredDefinitions.get(key);
  }

  public listRegistered(): RegisteredPermissionDefinition[] {
    return Array.from(this.registeredDefinitions.values());
  }

  private assertRegistered(permission: PermissionString): void {
    const parsed = parsePermission(permission);
    if (!parsed) {
      throw new Error(`Invalid permission string: ${permission}`);
    }
    // Scope is exact-match in the grammar: `tenant | organization | store | self`.
    // Wildcards are allowed only on domain, resource, or action segments.
    if (parsed.scope === "*") {
      throw new Error(
        `Invalid permission string: scope cannot be a wildcard — ${permission}`,
      );
    }
  }

  grant(
    permission: PermissionString,
    tenant: TenantIdentity,
    grantedTo: string,
  ): void {
    this.assertRegistered(permission);

    this.entries.push({
      permission,
      tenant,
      grantedTo,
      explicit: true,
    });
  }

  deny(
    permission: PermissionString,
    tenant: TenantIdentity,
    deniedFrom: string,
  ): void {
    this.assertRegistered(permission);

    this.entries.push({
      permission,
      tenant,
      grantedTo: deniedFrom,
      explicit: false,
    });
  }

  private checkTenant(
    entryTenant: TenantIdentity,
    requestTenant: TenantIdentity,
  ): boolean {
    if (entryTenant.organizationId !== requestTenant.organizationId) {
      return false;
    }
    if (entryTenant.spaceId && entryTenant.spaceId !== requestTenant.spaceId) {
      return false;
    }
    return true;
  }

  private match(
    request: PermissionString,
    entry: PermissionEntry,
    tenant: TenantIdentity,
    app: string,
  ): PermissionMatch {
    if (entry.grantedTo !== app && entry.grantedTo !== "*") {
      return "none";
    }
    if (!this.checkTenant(entry.tenant, tenant)) {
      return "none";
    }

    const requestSegments = request.split(":");
    const entrySegments = entry.permission.split(":");

    if (!matchSegments(requestSegments, entrySegments)) {
      return "none";
    }

    if (!entry.explicit) {
      return "deny";
    }

    const hasWildcard = entrySegments.some((s) => s === "*");
    if (hasWildcard) {
      return "wildcard";
    }

    return "allow";
  }

  check(
    permission: PermissionString,
    tenant: TenantIdentity,
    app: string,
  ): boolean {
    let best: PermissionMatch = "none";

    for (const entry of this.entries) {
      const m = this.match(permission, entry, tenant, app);
      if (m === "deny") return false;
      if (m === "allow" && best !== "wildcard") {
        best = "allow";
      } else if (m === "wildcard" && best === "none") {
        best = "wildcard";
      }
    }

    return best !== "none";
  }

  clear(): void {
    this.entries.length = 0;
    this.registeredDefinitions.clear();
  }
}

export class AuthorizationEngine {
  constructor(private readonly registry: PermissionRegistry) {}

  authorize(
    permission: PermissionString,
    tenant: TenantIdentity,
    app: string,
  ): boolean {
    return this.registry.check(permission, tenant, app);
  }
}
