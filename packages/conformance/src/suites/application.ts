/**
 * @mosaix/conformance — Application Conformance Test Suite
 */

export class ApplicationConformanceSuite {
  static validateManifest(manifest: Record<string, unknown>): boolean {
    return Boolean(manifest && manifest["id"] && manifest["name"]);
  }
}
