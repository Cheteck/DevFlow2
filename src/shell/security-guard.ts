/**
 * @mosaix/shell — Production Security Guard
 * Enforces cryptographic secret entropy and fail-fast checks in production.
 */

export class SecurityGuard {
  static validateEnvironment(): { valid: boolean; warnings: string[]; errors: string[] } {
    const isProduction = process.env.NODE_ENV === "production";
    const warnings: string[] = [];
    const errors: string[] = [];

    const jwtSecret = process.env.MOSAIX_AUTH_JWT_SECRET || process.env.JWT_SECRET;
    const sessionSecret = process.env.MOSAIX_SESSION_SECRET;

    if (isProduction) {
      if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes("dev-secret") || jwtSecret.includes("secret123")) {
        errors.push("FATAL_SECURITY: Production JWT secret is missing, insecure or has insufficient entropy (< 256 bits).");
      }
      if (!sessionSecret || sessionSecret.length < 32) {
        warnings.push("SECURITY_WARN: Session secret should have at least 32 characters in production.");
      }
    } else {
      if (!jwtSecret) {
        warnings.push("DEV_NOTICE: Using fallback development JWT secret. Do not use in production.");
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  static enforceProductionConstraints(): void {
    const check = this.validateEnvironment();
    if (!check.valid) {
      const errorMsg = `[SECURITY BREACH PREVENTION] Cannot start server:\n${check.errors.join("\n")}`;
      console.error(errorMsg);
      if (process.env.NODE_ENV === "production") {
        throw new Error(errorMsg);
      }
    }
    for (const w of check.warnings) {
      console.warn(`[SecurityGuard] ${w}`);
    }
  }
}
