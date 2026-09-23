/**
 * @mosaix/container — DI Error Classes
 */

export class DependencyResolutionError extends Error {
  constructor(token: string, message: string) {
    super(`Failed to resolve token [${token}]: ${message}`);
    this.name = "DependencyResolutionError";
  }
}
