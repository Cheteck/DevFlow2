/**
 * @apps/spaces — Dynamic Custom Role & ABAC Policy Engine (GAP-02)
 */

export interface CustomSpaceRole {
  roleId: string;
  roleName: string;
  description?: string;
  allowedCapabilities: string[]; // e.g. ["commerce.orders.create", "solara.post.create"]
}

export class SpaceRolePolicyEngine {
  private roles = new Map<string, CustomSpaceRole>();

  constructor() {
    // Built-in standard roles
    this.createRole({
      roleId: "owner",
      roleName: "Space Owner",
      allowedCapabilities: ["*"],
    });
    this.createRole({
      roleId: "admin",
      roleName: "Space Administrator",
      allowedCapabilities: ["spaces.*", "commerce.*", "solara.*", "beam.*"],
    });
  }

  createRole(role: CustomSpaceRole): CustomSpaceRole {
    this.roles.set(role.roleId, role);
    return role;
  }

  getRole(roleId: string): CustomSpaceRole | undefined {
    return this.roles.get(roleId);
  }

  evaluateCapabilityAccess(roleId: string, requiredCapability: string): boolean {
    const role = this.roles.get(roleId);
    if (!role) return false;

    return role.allowedCapabilities.some(
      (cap) => cap === "*" || cap === requiredCapability || (cap.endsWith(".*") && requiredCapability.startsWith(cap.slice(0, -2)))
    );
  }
}
