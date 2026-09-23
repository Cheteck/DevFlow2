/**
 * @mosaix/conformance — Plugin Conformance Suite
 */
export class PluginConformanceSuite {
  static validate(plugin: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!plugin.id || typeof plugin.id !== "string") {
      errors.push("Plugin must have a valid string 'id'.");
    }
    return { valid: errors.length === 0, errors };
  }
}
