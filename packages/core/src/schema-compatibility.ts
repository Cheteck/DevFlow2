/**
 * Event Schema Compatibility Evaluator (Phase 6)
 */

export interface EventSchemaVersion {
  readonly version: string; // e.g. "1.0.0"
  readonly schema: unknown;
}

export class EventSchemaCompatibility {
  static isCompatible(oldVersion: string, newVersion: string): boolean {
    const [oldMajor] = oldVersion.split(".").map(Number);
    const [newMajor] = newVersion.split(".").map(Number);

    if (oldMajor === undefined || newMajor === undefined) {
      return false;
    }

    // Breaking changes increment major version
    return oldMajor === newMajor;
  }
}
