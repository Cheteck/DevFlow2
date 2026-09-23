/**
 * @mosaix/conformance — Tenant Conformance Suite
 */
export class TenantConformanceSuite {
  static validate(tenant: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!tenant.tenantId || typeof tenant.tenantId !== "string") {
      errors.push("Tenant object must specify 'tenantId'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
