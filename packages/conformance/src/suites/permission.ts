/**
 * @mosaix/conformance — Permission Conformance Suite
 */
export class PermissionConformanceSuite {
  static validate(permission: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!permission.key || typeof permission.key !== "string") {
      errors.push("Permission must have a valid string 'key'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
