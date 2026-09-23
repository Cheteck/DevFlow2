/**
 * @mosaix/conformance — MOSAIX-APP Contract & Architecture Validator
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ConformanceValidationResult {
  valid: boolean;
  errors: string[];
}

export class AppConformanceValidator {
  static validate(manifest: Record<string, unknown>): ConformanceValidationResult {
    const errors: string[] = [];

    if (!manifest) {
      return { valid: false, errors: ["Manifest is null or undefined."] };
    }

    if (manifest["type"] !== "application") {
      errors.push("Property 'type' must be 'application'.");
    }

    const id = manifest["id"];
    if (!id || typeof id !== "string") {
      errors.push("Property 'id' is required and must be a string.");
    } else {
      const idRegex = /^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i;
      if (!idRegex.test(id)) {
        errors.push(`Property 'id' [${id}] does not match valid application ID format.`);
      }
    }

    if (!manifest["name"] || typeof manifest["name"] !== "string") {
      errors.push("Property 'name' is required and must be a string.");
    }

    const version = manifest["version"];
    if (!version || typeof version !== "string") {
      errors.push("Property 'version' is required and must be a string.");
    } else {
      const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9_.-]+)?$/i;
      if (!semverRegex.test(version)) {
        errors.push(`Property 'version' [${version}] must follow semver format (major.minor.patch).`);
      }
    }

    const domain = manifest["domain"] as Record<string, unknown> | undefined;
    if (!domain || typeof domain["name"] !== "string") {
      errors.push("Property 'domain.name' is required.");
    }

    const runtime = manifest["runtime"] as Record<string, unknown> | undefined;
    if (!runtime || !runtime["entrypoint"]) {
      errors.push("Property 'runtime.entrypoint' is required.");
    }

    if (!Array.isArray(manifest["capabilities"])) {
      errors.push("Property 'capabilities' must be an array.");
    }

    const permissions = manifest["permissions"];
    if (!Array.isArray(permissions)) {
      errors.push("Property 'permissions' must be an array.");
    } else {
      const permRegex = /^[a-z0-9_.-]+:[a-z0-9_.-]+:[a-z0-9_.-]+(:(tenant|organization|store|self))?$/i;
      for (const perm of permissions) {
        if (typeof perm !== "string" || !permRegex.test(perm)) {
          errors.push(`Permission [${perm}] must match valid permission pattern (domain:resource:action[:scope]).`);
        }
      }
    }

    const events = manifest["events"];
    if (!Array.isArray(events)) {
      errors.push("Property 'events' must be an array.");
    } else {
      const eventRegex = /^[a-z0-9_.-]+(\.[a-z0-9_.-]+)+$/i;
      for (const evt of events) {
        if (typeof evt !== "string" || !eventRegex.test(evt)) {
          errors.push(`Event [${evt}] must match pattern 'namespace.event.type'.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static async validateApp(
    manifest: Record<string, unknown>,
    _metadata?: { capabilities?: string[]; events?: string[]; permissions?: string[] }
  ): Promise<ConformanceValidationResult> {
    const res = this.validate(manifest);
    if (!res.valid) {
      throw new Error(`[AppConformanceValidationError] ${res.errors.join(", ")}`);
    }
    return res;
  }

  static validateWorkspaceAppDirectory(appDir: string): ConformanceValidationResult {
    const errors: string[] = [];

    const manifestPath = path.join(appDir, "mosaix.json");
    if (!fs.existsSync(manifestPath)) {
      return { valid: false, errors: [`Manifest file mosaix.json missing in directory [${appDir}].`] };
    }

    try {
      const manifestContent = fs.readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent) as Record<string, unknown>;
      const manifestResult = this.validate(manifest);
      errors.push(...manifestResult.errors);
    } catch (err: unknown) {
      errors.push(`Invalid JSON in mosaix.json: ${err instanceof Error ? err.message : String(err)}`);
    }

    const indexPath = path.join(appDir, "src", "index.ts");
    const compositionRootPath = path.join(appDir, "src", "composition-root.ts");
    if (!fs.existsSync(indexPath) && !fs.existsSync(compositionRootPath)) {
      errors.push(`Application Entrypoint [src/index.ts] missing in application [${appDir}].`);
    }

    const frontendPath = path.join(appDir, "frontend", "src", "index.ts");
    if (!fs.existsSync(frontendPath)) {
      errors.push(`Frontend entrypoint [frontend/src/index.ts] missing in application [${appDir}].`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateAllWorkspaceApps(appsRootDir: string): Record<string, ConformanceValidationResult> {
    const results: Record<string, ConformanceValidationResult> = {};

    if (!fs.existsSync(appsRootDir)) {
      return results;
    }

    const entries = fs.readdirSync(appsRootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        const appDir = path.join(appsRootDir, entry.name);
        results[entry.name] = this.validateWorkspaceAppDirectory(appDir);
      }
    }

    return results;
  }
}
