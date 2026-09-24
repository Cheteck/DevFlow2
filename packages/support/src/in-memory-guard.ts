/**
 * @mosaix/support — In-Memory Guard
 * Enforces rule: No in-memory storage in production unless development mode and only as fallback with dev server signal.
 */

export class InMemoryGuard {
  static reportFallback(componentName: string, reason = "missing persistent infrastructure configuration"): void {
    const isProduction = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";
    const allowInProd = process.env.ALLOW_IN_MEMORY_IN_PRODUCTION === "true";

    if (isProduction && !allowInProd) {
      throw new Error(
        `[ProductionInvariantViolation] In-memory storage/adapter "${componentName}" is strictly forbidden in production (${reason}). Provide a persistent infrastructure adapter (SQLite, PostgreSQL, Redis, etc.) or set ALLOW_IN_MEMORY_IN_PRODUCTION=true if explicitly intended.`
      );
    }

    if (!isProduction) {
      console.warn(
        `\n[MOSAIX DEV SERVER SIGNAL] ⚠️ In-memory fallback adapter "${componentName}" is active due to ${reason}.\n`
      );
    }
  }
}
