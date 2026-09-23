/**
 * @mosaix/core — Plugin error hierarchy (T-EXT-04)
 *
 * Extends the kernel taxonomy with the plugin domain. Every plugin error
 * carries a stable `code` and structured `details` so consumers can match on
 * codes instead of messages (same contract as `kernel-errors.ts`).
 *
 * Hierarchy:
 *   KernelError
 *   └── PluginError
 *       ├── PluginRegistrationError   (invalid manifest, duplicate key)
 *       └── PluginLifecycleError      (unknown plugin, activation state)
 */

import { KernelError } from "../kernel-errors";
import type { KernelErrorDetails } from "../kernel-errors";

export class PluginError extends KernelError {
  constructor(code: string, message: string, details: KernelErrorDetails = {}) {
    super(code, message, details);
    this.name = "PluginError";
  }
}

export class PluginRegistrationError extends PluginError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("PLUGIN_REGISTRATION_ERROR", message, details);
    this.name = "PluginRegistrationError";
  }
}

export class PluginLifecycleError extends PluginError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("PLUGIN_LIFECYCLE_ERROR", message, details);
    this.name = "PluginLifecycleError";
  }
}
