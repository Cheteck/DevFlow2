/**
 * @mosaix/core — Theme errors (THEME-12)
 *
 * Theme errors extend KernelError (D-22): stable codes, structured details,
 * no message-string matching anywhere. Hierarchy:
 *
 *   KernelError
 *   └── ThemeError
 *       ├── ThemeNotFoundError
 *       ├── ThemeCycleError
 *       ├── ThemeVersionError
 *       ├── ThemeValidationError
 *       ├── ThemeInjectionError          (raised by ThemeInjector) — THEME-12, D-21
 *       ├── ThemeCompatibilityError     (declared, not raised — D-21)
 *       └── ThemeAuthorizationError     (declared, not raised — D-21)
 *
 * D-21: the Phase-2 RAISED set is NotFound / Cycle / Version / Validation
 * (schema-invalid assignments). ThemeCompatibilityError and
 * ThemeAuthorizationError are declared but NOT raised in Phase 2 — the gate
 * for raising them is the Governance PolicyResolver (later phase).
 * ThemeInjectionError (listed in REQUIREMENTS.md THEME-12) is declared here
 * (THEME_INJECTION) and raised by the Phase-3 ThemeInjector on
 * style-application failure — no longer deferred.
 *
 * Consumers match on `code` (THEME_*), never on message strings (D-22).
 * Consumers: ThemeResolver (02-03), ThemeInheritanceResolver,
 * InMemoryThemeAssignmentsStore.
 */

import { KernelError } from "../kernel-errors";
import type { KernelErrorDetails } from "../kernel-errors";

// D-22: theme-prefixed code union (no string-matching on messages).
export type ThemeErrorCode =
  | "THEME_NOT_FOUND"
  | "THEME_CYCLE"
  | "THEME_VERSION"
  | "THEME_VALIDATION"
  | "THEME_COMPATIBILITY"
  | "THEME_AUTHORIZATION"
  | "THEME_INJECTION";

/** Base class for all theme errors — KernelError-derived (D-22). */
export class ThemeError extends KernelError {
  constructor(
    code: ThemeErrorCode,
    message: string,
    details: KernelErrorDetails = {},
  ) {
    super(code, message, details);
    this.name = "ThemeError";
  }
}

/** A referenced theme does not exist (missing id, fails-closed, D-20). */
export class ThemeNotFoundError extends ThemeError {
  constructor(themeId: string) {
    super("THEME_NOT_FOUND", `Theme not found: ${themeId}`, { themeId });
    this.name = "ThemeNotFoundError";
  }
}

/** The `extends` inheritance graph contains a cycle (D-19). */
export class ThemeCycleError extends ThemeError {
  constructor(cycle: readonly string[]) {
    super(
      "THEME_CYCLE",
      `Theme inheritance cycle detected: ${cycle.join(" → ")}`,
      { cycle },
    );
    this.name = "ThemeCycleError";
  }
}

/** The resolved theme version does not satisfy the required range. */
export class ThemeVersionError extends ThemeError {
  constructor(themeId: string, required: string, found: string) {
    super(
      "THEME_VERSION",
      `Theme ${themeId}: required ${required} but found ${found}`,
      { themeId, required, found },
    );
    this.name = "ThemeVersionError";
  }
}

/** A theme assignment failed Zod validation (schema breach, D-21). */
export class ThemeValidationError extends ThemeError {
  constructor(issues: readonly unknown[]) {
    super("THEME_VALIDATION", "Invalid theme assignment", { issues });
    this.name = "ThemeValidationError";
  }
}

// (Phase 2: declared, not raised — raised by the Phase-3 Governance PolicyResolver)
export class ThemeCompatibilityError extends ThemeError {
  constructor() {
    super("THEME_COMPATIBILITY", "Theme compatibility error");
    this.name = "ThemeCompatibilityError";
  }
}

// (Phase 2: declared, not raised — raised by the Phase-3 Governance PolicyResolver)
export class ThemeAuthorizationError extends ThemeError {
  constructor() {
    super("THEME_AUTHORIZATION", "Theme authorization error");
    this.name = "ThemeAuthorizationError";
  }
}

// (Phase 3: raised by ThemeInjector on style-application failure, THEME-12)
export class ThemeInjectionError extends ThemeError {
  constructor(hostKind: string, cause?: unknown) {
    super("THEME_INJECTION", `Theme injection failed: ${hostKind}`, {
      hostKind,
      ...(cause !== undefined ? { cause: String(cause) } : {}),
    });
    this.name = "ThemeInjectionError";
  }
}
