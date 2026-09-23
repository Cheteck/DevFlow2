/**
 * @mosaix/conformance — Capability Conformance Suite
 */

export function runCapabilitySuite(capabilities: Array<{ id: string; version: string }>) {
  const errors: string[] = [];
  for (const cap of capabilities) {
    if (!cap.id || !cap.version) {
      errors.push(`Capability [${cap.id ?? "unknown"}] is missing required fields.`);
    }
  }
  return { valid: errors.length === 0, errors };
}
