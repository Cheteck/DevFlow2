/**
 * @mosaix/conformance — Security Conformance Suite
 */
export class SecurityConformanceSuite {
  static validate(policy: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!policy.name || typeof policy.name !== "string") {
      errors.push("Security policy must contain a 'name'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
