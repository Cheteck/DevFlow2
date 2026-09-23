/**
 * @mosaix/conformance — Auth Conformance Suite
 */
export class AuthConformanceSuite {
  static validate(authCtx: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!authCtx.userId || typeof authCtx.userId !== "string") {
      errors.push("Auth context must provide 'userId'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
