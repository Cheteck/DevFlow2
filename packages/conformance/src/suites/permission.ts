/**
 * @mosaix/conformance — Permission Conformance Suite
 */
export class PermissionConformanceSuite {
  static validate(permission: Record<string, unknown> | string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    let permKey: string | undefined;

    if (typeof permission === "string") {
      permKey = permission;
    } else if (permission && typeof permission === "object") {
      if (typeof permission.key === "string") {
        permKey = permission.key;
      }
    }

    if (!permKey || permKey.trim() === "") {
      errors.push("Permission must be a valid string or an object with non-empty string 'key'.");
    } else {
      const permRegex = /^[a-z0-9_.-]+[:.][a-z0-9_.-]+([:.][a-z0-9_.-]+)*$/i;
      if (!permRegex.test(permKey) || (!permKey.includes(":") && !permKey.includes("."))) {
        errors.push(`Permission [${permKey}] must contain at least two segments separated by ':' or '.'.`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
