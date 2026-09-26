/**
 * @mosaix/conformance — Event Conformance Suite
 */
export class EventConformanceSuite {
  static validate(event: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!event || typeof event !== "object") {
      return { valid: false, errors: ["Event must be an object."] };
    }

    const name = event.name ?? event.type;
    if (!name || typeof name !== "string" || name.trim() === "") {
      errors.push("Event must have a valid non-empty string 'name' or 'type'.");
    } else {
      const eventRegex = /^[a-z0-9_.-]+$/i;
      if (!eventRegex.test(name)) {
        errors.push(`Event name [${name}] contains invalid characters.`);
      }
    }

    if (event.version !== undefined && typeof event.version === "string") {
      const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9_.-]+)?$/i;
      if (!semverRegex.test(event.version)) {
        errors.push(`Event version [${event.version}] must follow semver format.`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
