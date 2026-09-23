import type { ApplicationManifest } from "@mosaix/contracts";
import { RegistrationError } from "./kernel-errors";

const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

export class Invariants {
  static assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new RegistrationError(`[KernelInvariantViolation] ${message}`);
    }
  }

  static manifest(manifest: ApplicationManifest): void {
    if (!manifest || !manifest.id) {
      const rawId = manifest && typeof manifest === "object" && "id" in manifest ? String((manifest as { id?: unknown }).id) : undefined;
      throw new RegistrationError("[KernelInvariantViolation] Manifest must have an id.", {
        appId: rawId,
      });
    }
    // semver strict (T-18) — fail fast at register, not deep in lifecycle
    if (typeof manifest.version !== "string" || !SEMVER_RE.test(manifest.version)) {
      throw new RegistrationError(
        `Invalid application manifest for "${manifest.id}": version must be semver (x.y.z), got "${manifest.version}"`,
        { appId: manifest.id },
      );
    }
    // runtime entrypoint requis
    const entrypoint = manifest.runtime?.entrypoint;
    if (typeof entrypoint !== "string" || entrypoint.length === 0) {
      throw new RegistrationError(
        `Invalid application manifest for "${manifest.id}": runtime.entrypoint is required`,
        { appId: manifest.id },
      );
    }
    // scope exact-match : jamais de wildcard (grammaire permission tenant|organization|store|self)
    const permissions = manifest.permissions;
    if (Array.isArray(permissions)) {
      const validScopes = ["tenant", "organization", "store", "self"];
      for (const p of permissions) {
        const permStr = typeof p === "string" ? p : p?.permission;
        if (!permStr || permStr.split(":").length !== 4) {
          throw new RegistrationError(
            `Invalid application manifest for "${manifest.id}": permission must follow 4-part grammar (domain:resource:action:scope) — got "${permStr}"`,
            { appId: manifest.id, permission: permStr },
          );
        }
        const segments = permStr.split(":");
        const scope = typeof p === "object" && p !== null && "scope" in p && p.scope ? p.scope : segments[3];
        if (scope === "*") {
          throw new RegistrationError(
            `Invalid application manifest for "${manifest.id}": scope cannot be a wildcard — ${permStr}`,
            { appId: manifest.id, permission: permStr },
          );
        }
        if (!validScopes.includes(scope)) {
          throw new RegistrationError(
            `Invalid application manifest for "${manifest.id}": invalid scope "${scope}" in permission — ${permStr}`,
            { appId: manifest.id, permission: permStr },
          );
        }
      }
    }
  }
}
