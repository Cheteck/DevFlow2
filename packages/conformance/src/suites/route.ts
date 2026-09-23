/**
 * @mosaix/conformance — Route Conformance Suite
 */
export class RouteConformanceSuite {
  static validate(route: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!route.path || typeof route.path !== "string") {
      errors.push("Route must specify a valid string 'path'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
