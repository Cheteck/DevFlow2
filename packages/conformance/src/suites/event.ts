/**
 * @mosaix/conformance — Event Conformance Suite
 */
export class EventConformanceSuite {
  static validate(event: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!event.name || typeof event.name !== "string") {
      errors.push("Event must have a valid string 'name'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
