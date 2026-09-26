/**
 * @mosaix/theme — Theme Error Hierarchy
 */

export type KernelErrorDetails = Record<string, unknown>;

export class KernelError extends Error {
  readonly code: string;
  readonly details: KernelErrorDetails;

  constructor(code: string, message: string, details: KernelErrorDetails = {}) {
    super(message);
    this.name = "KernelError";
    this.code = code;
    this.details = details;
  }
}

export type ThemeErrorCode =
  | "THEME_NOT_FOUND"
  | "THEME_CYCLE"
  | "THEME_VERSION"
  | "THEME_VALIDATION"
  | "THEME_COMPATIBILITY"
  | "THEME_AUTHORIZATION"
  | "THEME_INJECTION";

export class ThemeError extends KernelError {
  constructor(
    codeOrMessage: ThemeErrorCode | string,
    messageOrDetails?: string | KernelErrorDetails,
    details: KernelErrorDetails = {}
  ) {
    const hasMessage = typeof messageOrDetails === "string";
    const code = (hasMessage ? codeOrMessage : "THEME_VALIDATION") as ThemeErrorCode;
    const message = hasMessage ? (messageOrDetails as string) : codeOrMessage;
    const det =
      !hasMessage && messageOrDetails !== undefined
        ? (messageOrDetails as KernelErrorDetails)
        : details;

    super(code, message, det);
    this.name = "ThemeError";
  }
}

export class ThemeNotFoundError extends ThemeError {
  constructor(themeId: string) {
    super("THEME_NOT_FOUND", `Theme not found: ${themeId}`, { themeId });
    this.name = "ThemeNotFoundError";
  }
}

export class ThemeCycleError extends ThemeError {
  constructor(cycle: readonly string[]) {
    super("THEME_CYCLE", `Theme inheritance cycle detected: ${cycle.join(" → ")}`, { cycle });
    this.name = "ThemeCycleError";
  }
}

export class ThemeVersionError extends ThemeError {
  constructor(themeId: string, required: string, found: string) {
    super("THEME_VERSION", `Theme ${themeId}: required ${required} but found ${found}`, {
      themeId,
      required,
      found,
    });
    this.name = "ThemeVersionError";
  }
}

export class ThemeValidationError extends ThemeError {
  constructor(issues: readonly unknown[]) {
    super("THEME_VALIDATION", "Invalid theme assignment or manifest", { issues });
    this.name = "ThemeValidationError";
  }
}

export class ThemeCompatibilityError extends ThemeError {
  constructor() {
    super("THEME_COMPATIBILITY", "Theme compatibility error");
    this.name = "ThemeCompatibilityError";
  }
}

export class ThemeAuthorizationError extends ThemeError {
  constructor() {
    super("THEME_AUTHORIZATION", "Theme authorization error");
    this.name = "ThemeAuthorizationError";
  }
}

export class ThemeInjectionError extends ThemeError {
  constructor(hostKind: string, cause?: unknown) {
    super("THEME_INJECTION", `Theme injection failed: ${hostKind}`, {
      hostKind,
      ...(cause !== undefined ? { cause: String(cause) } : {}),
    });
    this.name = "ThemeInjectionError";
  }
}
