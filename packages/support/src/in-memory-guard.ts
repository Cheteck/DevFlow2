/**
 * @mosaix/support — In-Memory Guard
 * Enforces rule: No in-memory storage in production, and none whenever demo
 * mode is explicitly off (`MOSAIX_DEMO_USERS=false`) — volatile adapters
 * would silently lose persisted state. Otherwise (dev/test with demo on)
 * fallbacks are allowed with a dev server warning signal.
 */
import { isDemoMode } from "./demo-mode.js";

export class InMemoryGuard {
  static reportFallback(componentName: string, reason = "missing persistent infrastructure configuration"): void {
    const isProduction = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod" || process.env.MOSAIX_ENV === "production";
    const allowInProd = process.env.ALLOW_IN_MEMORY_IN_PRODUCTION === "true";

    if ((isProduction || InMemoryGuard.isDemoExplicitlyDisabled()) && !allowInProd) {
      throw new Error(
        `[ProductionInvariantViolation] In-memory storage/adapter "${componentName}" is strictly forbidden in production or when demo mode is off (MOSAIX_DEMO_USERS=false) (${reason}). Provide a persistent infrastructure adapter (SQLite, PostgreSQL, Redis, etc.) or set ALLOW_IN_MEMORY_IN_PRODUCTION=true if explicitly intended.`
      );
    }

    if (!isProduction) {
      console.warn(
        `\n[MOSAIX DEV SERVER SIGNAL] ⚠️ In-memory fallback adapter "${componentName}" is active due to ${reason}.\n`
      );
    }
  }

  /**
   * Demo kill-switch: explicit `MOSAIX_DEMO_USERS=false` (or any
   * non-truthy value) disables demo, as does a production environment
   * when the flag is unset. Delegates to the canonical `isDemoMode()`.
   */
  static isDemoExplicitlyDisabled(source?: Record<string, string | undefined>): boolean {
    return !isDemoMode(source);
  }
}
