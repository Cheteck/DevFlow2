/**
 * @mosaix/core — Error hierarchy
 *
 * Stable, serializable, loggable error taxonomy for the kernel. Every error
 * raised across the API boundary extends `KernelError` with a stable `code`
 * and structured `details`, so consumers (API, Control Plane, observability)
 * can match on codes instead of message strings.
 *
 * Hierarchy:
 *   KernelError
 *   ├── RegistrationError
 *   ├── LifecycleError
 *   ├── AuthorizationError
 *   ├── CapabilityError
 *   ├── EventError
 *   ├── ValidationError
 *   └── ServiceNotInstalledError
 */

export interface KernelErrorDetails {
  [key: string]: unknown;
}

export class KernelError extends Error {
  readonly code: string;
  readonly details: KernelErrorDetails;

  constructor(code: string, message: string, details: KernelErrorDetails = {}) {
    super(message);
    this.name = "KernelError";
    this.code = code;
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class RegistrationError extends KernelError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("REGISTRATION_ERROR", message, details);
    this.name = "RegistrationError";
  }
}

export class LifecycleError extends KernelError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("LIFECYCLE_ERROR", message, details);
    this.name = "LifecycleError";
  }
}

export class AuthorizationError extends KernelError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("AUTHORIZATION_ERROR", message, details);
    this.name = "AuthorizationError";
  }
}

export class CapabilityError extends KernelError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("CAPABILITY_ERROR", message, details);
    this.name = "CapabilityError";
  }
}

export class EventError extends KernelError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("EVENT_ERROR", message, details);
    this.name = "EventError";
  }
}

export class ValidationError extends KernelError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export interface ServiceNotInstalledOptions {
  /** Full list of missing required canonical services (T-EXT-11). */
  missingServices?: string[];
  /** Override the default per-service message (aggregated list). */
  message?: string;
}

export class ServiceNotInstalledError extends KernelError {
  constructor(serviceName: string, options: ServiceNotInstalledOptions = {}) {
    super(
      "SERVICE_NOT_INSTALLED",
      options.message ??
        `Service "${serviceName}" is not installed — install the module that provides it`,
      options.missingServices?.length
        ? { service: serviceName, missingServices: options.missingServices }
        : { service: serviceName },
    );
    this.name = "ServiceNotInstalledError";
  }
}

/** Normalize any thrown value into a KernelError (preserving message). */
export function asKernelError(error: unknown): KernelError {
  if (error instanceof KernelError) return error;
  if (error instanceof Error) {
    return new KernelError("UNKNOWN_ERROR", error.message);
  }
  return new KernelError("UNKNOWN_ERROR", String(error));
}
