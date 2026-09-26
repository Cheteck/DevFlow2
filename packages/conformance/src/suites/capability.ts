/**
 * @mosaix/conformance — Capability Conformance Suite
 */

export function runCapabilitySuite(capabilities: Array<{ id?: string; version?: string }>) {
  const errors: string[] = [];
  const capRegex = /^[a-z0-9_.-]+\.[a-z0-9_.-]+\.[a-z0-9_.-]+$/i;
  const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9_.-]+)?$/i;

  if (!Array.isArray(capabilities)) {
    return { valid: false, errors: ["Capabilities must be an array."] };
  }

  for (const cap of capabilities) {
    if (!cap || typeof cap !== "object") {
      errors.push("Capability entry must be an object.");
      continue;
    }
    if (!cap.id || typeof cap.id !== "string") {
      errors.push(`Capability [${cap.id ?? "unknown"}] is missing required string property 'id'.`);
    } else if (!capRegex.test(cap.id)) {
      errors.push(`Capability id [${cap.id}] must match format 'domain.resource.action'.`);
    }

    if (!cap.version || typeof cap.version !== "string") {
      errors.push(`Capability [${cap.id ?? "unknown"}] is missing required string property 'version'.`);
    } else if (!semverRegex.test(cap.version)) {
      errors.push(`Capability version [${cap.version}] must follow semver format (major.minor.patch).`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export class CapabilityConformanceSuite {
  static validate(capabilities: Array<{ id?: string; version?: string }>) {
    return runCapabilitySuite(capabilities);
  }
}
