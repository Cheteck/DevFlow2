/**
 * @mosaix/core — AdonisJS-inspired Authorization Policy base class
 */
export abstract class BasePolicy {
  /**
   * Optional before hook executed before any policy method.
   * Return true/false to allow/deny immediately, or null/undefined to proceed to the specific method.
   */
  before?(_user: unknown, _ability: string, _resource?: unknown): boolean | null | undefined {
    return null;
  }
}
