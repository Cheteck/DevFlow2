/**
 * @mosaix/plugin-engine/runtime — Plugin Settings Validator & State
 */

import type { JSONSchemaProperty, PluginSettingsSchema } from "../core/index.js";

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedSettings: Record<string, unknown>;
}

export class PluginSettingsValidator {
  /**
   * Validate a settings object against a PluginSettingsSchema and populate defaults
   */
  static validate(
    schema: PluginSettingsSchema | undefined,
    rawSettings: Record<string, unknown> = {}
  ): SettingsValidationResult {
    if (!schema) {
      return { valid: true, errors: [], sanitizedSettings: { ...rawSettings } };
    }

    const errors: string[] = [];
    const sanitized: Record<string, unknown> = {};

    // 1. Check required fields
    if (schema.required) {
      for (const requiredKey of schema.required) {
        if (rawSettings[requiredKey] === undefined && schema.properties[requiredKey]?.default === undefined) {
          errors.push(`Missing required setting: "${requiredKey}"`);
        }
      }
    }

    // 2. Validate individual properties
    for (const [key, propDef] of Object.entries(schema.properties)) {
      const val = rawSettings[key] !== undefined ? rawSettings[key] : propDef.default;

      if (val !== undefined) {
        const propErrors = this.validateProperty(key, val, propDef);
        if (propErrors.length > 0) {
          errors.push(...propErrors);
        } else {
          sanitized[key] = val;
        }
      }
    }

    // 3. Additional properties check if explicitly disabled
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(rawSettings)) {
        if (!schema.properties[key]) {
          errors.push(`Unknown setting "${key}" is not permitted by schema.`);
        }
      }
    } else {
      // Retain permissible additional settings
      for (const [key, val] of Object.entries(rawSettings)) {
        if (sanitized[key] === undefined) {
          sanitized[key] = val;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedSettings: sanitized,
    };
  }

  private static validateProperty(key: string, val: unknown, def: JSONSchemaProperty): string[] {
    const errs: string[] = [];

    // Type check
    if (def.type === "string") {
      if (typeof val !== "string") {
        errs.push(`Setting "${key}" must be a string, got ${typeof val}.`);
      } else {
        if (def.minLength !== undefined && val.length < def.minLength) {
          errs.push(`Setting "${key}" length must be >= ${def.minLength}.`);
        }
        if (def.maxLength !== undefined && val.length > def.maxLength) {
          errs.push(`Setting "${key}" length must be <= ${def.maxLength}.`);
        }
      }
    } else if (def.type === "number" || def.type === "integer") {
      if (typeof val !== "number" || isNaN(val)) {
        errs.push(`Setting "${key}" must be a valid number.`);
      } else {
        if (def.type === "integer" && !Number.isInteger(val)) {
          errs.push(`Setting "${key}" must be an integer.`);
        }
        if (def.minimum !== undefined && val < def.minimum) {
          errs.push(`Setting "${key}" must be >= ${def.minimum}.`);
        }
        if (def.maximum !== undefined && val > def.maximum) {
          errs.push(`Setting "${key}" must be <= ${def.maximum}.`);
        }
      }
    } else if (def.type === "boolean") {
      if (typeof val !== "boolean") {
        errs.push(`Setting "${key}" must be a boolean.`);
      }
    } else if (def.type === "array") {
      if (!Array.isArray(val)) {
        errs.push(`Setting "${key}" must be an array.`);
      }
    } else if (def.type === "object") {
      if (typeof val !== "object" || val === null || Array.isArray(val)) {
        errs.push(`Setting "${key}" must be an object.`);
      }
    }

    // Enum check
    if (def.enum && !def.enum.includes(val)) {
      errs.push(`Setting "${key}" must be one of [${def.enum.join(", ")}], got "${String(val)}".`);
    }

    return errs;
  }
}

export class PluginSettingsManager<T extends Record<string, unknown> = Record<string, unknown>> {
  private currentSettings: T;
  private listeners = new Set<(newSettings: T, oldSettings: T) => void>();

  constructor(private schema?: PluginSettingsSchema, initialSettings: Record<string, unknown> = {}) {
    const res = PluginSettingsValidator.validate(schema, initialSettings);
    if (!res.valid) {
      throw new Error(`Initial settings validation failed: ${res.errors.join(", ")}`);
    }
    this.currentSettings = res.sanitizedSettings as T;
  }

  get(): Readonly<T> {
    return Object.freeze({ ...this.currentSettings });
  }

  update(newPartial: Partial<T>): { success: boolean; errors?: string[] } {
    const candidate = { ...this.currentSettings, ...newPartial };
    const res = PluginSettingsValidator.validate(this.schema, candidate);
    if (!res.valid) {
      return { success: false, errors: res.errors };
    }

    const previous = this.currentSettings;
    this.currentSettings = res.sanitizedSettings as T;

    for (const listener of this.listeners) {
      try {
        listener(this.currentSettings, previous);
      } catch {
        // Suppress listener failure
      }
    }

    return { success: true };
  }

  onChange(listener: (newSettings: T, oldSettings: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
