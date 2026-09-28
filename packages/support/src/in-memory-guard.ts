/**
 * @mosaix/support — In-Memory Guard
 * Enforces rule: No in-memory storage in production or when MOSAIX_DEMO_USERS=false unless explicitly allowed.
 */

export class InMemoryGuard {
  static reportFallback(componentName: string, reason = "missing persistent infrastructure configuration"): void {
    const isProduction = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";
    const allowInProd = process.env.ALLOW_IN_MEMORY_IN_PRODUCTION === "true";
    const demoUsers = process.env.MOSAIX_DEMO_USERS;
    const isDemoDisabled = demoUsers !== undefined && demoUsers !== "" && (
      demoUsers.toLowerCase().trim() === "false" ||
      demoUsers.toLowerCase().trim() === "0" ||
      demoUsers.toLowerCase().trim() === "no" ||
      demoUsers.toLowerCase().trim() === "off"
    );

    if ((isProduction && !allowInProd) || isDemoDisabled) {
      throw new Error(
        `[InMemoryForbidden] In-memory storage/adapter "${componentName}" and mock data are strictly forbidden when MOSAIX_DEMO_USERS=false or in production (${reason}). Provide a persistent infrastructure adapter (SQLite, PostgreSQL, Redis, etc.).`
      );
    }

    if (!isProduction) {
      console.warn(
        `\n[MOSAIX DEV SERVER SIGNAL] ⚠️ In-memory fallback adapter "${componentName}" is active due to ${reason}.\n`
      );
    }
  }
}
