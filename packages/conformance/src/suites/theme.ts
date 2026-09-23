/**
 * @mosaix/conformance — Theme Conformance Suite
 */
export class ThemeConformanceSuite {
  static validate(theme: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!theme.name || typeof theme.name !== "string") {
      errors.push("Theme must specify a 'name'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
