/**
 * @mosaix/core — Policy Engine (Phase 7 Security & Tenancy)
 */

import type { PermissionString, TenantIdentity } from "@mosaix/types";
import type { PermissionRegistry } from "./permission";

export interface Role {
  readonly name: string;
  readonly permissions: readonly PermissionString[];
}

export interface Policy {
  readonly id: string;
  readonly role: string;
  readonly tenant: TenantIdentity;
  readonly effect: "allow" | "deny";
}

export class PolicyEngine {
  private readonly roles = new Map<string, Role>();
  private readonly policies: Policy[] = [];

  constructor(private readonly permissionRegistry: PermissionRegistry) {}

  registerRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  registerPolicy(policy: Policy): void {
    this.policies.push(policy);
    const role = this.roles.get(policy.role);
    if (!role) return;

    for (const permission of role.permissions) {
      if (policy.effect === "allow") {
        this.permissionRegistry.grant(permission, policy.tenant, policy.role);
      } else {
        this.permissionRegistry.deny(permission, policy.tenant, policy.role);
      }
    }
  }

  evaluate(permission: PermissionString, tenant: TenantIdentity, roleName: string): boolean {
    return this.permissionRegistry.check(permission, tenant, roleName);
  }
}
