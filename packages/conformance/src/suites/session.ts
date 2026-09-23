/**
 * @mosaix/conformance — Session Conformance Suite
 */
export class SessionConformanceSuite {
  static validate(session: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!session.sessionId || typeof session.sessionId !== "string") {
      errors.push("Session must contain a valid string 'sessionId'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
