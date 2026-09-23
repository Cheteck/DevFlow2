/**
 * ThemeErrors — co-located vitest suite gating the theme error taxonomy
 * (THEME-12, D-21/D-22).
 *
 * Behaviors locked here:
 *   1. each raised error carries its stable THEME_* code and class name,
 *      extends KernelError (D-22) and ThemeError;
 *   2. toJSON() returns { name, code, message, details } with structured
 *      details (cycle path array, themeId, version pair, zod issues);
 *   3. ThemeErrorCode is exactly the 7-member union; declared-only classes
 *      (Compatibility/Authorization, D-21) construct with their codes.
 *      ThemeInjectionError (Phase 3, THEME-12) is RAISED, not declared-only.
 *
 * No message-string matching anywhere — consumers match on `code`.
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import { KernelError } from "../kernel-errors";
import {
  ThemeAuthorizationError,
  ThemeCompatibilityError,
  ThemeCycleError,
  ThemeError,
  ThemeInjectionError,
  ThemeNotFoundError,
  ThemeValidationError,
  ThemeVersionError,
  type ThemeErrorCode,
} from "./theme-errors";

describe("ThemeErrors (THEME-12, D-21/D-22)", () => {
  it("each raised error carries its stable code and class name", () => {
    expect(new ThemeNotFoundError("ocean").code).toBe("THEME_NOT_FOUND");
    expect(new ThemeNotFoundError("ocean").name).toBe("ThemeNotFoundError");

    expect(new ThemeCycleError(["a", "b"]).code).toBe("THEME_CYCLE");
    expect(new ThemeCycleError(["a", "b"]).name).toBe("ThemeCycleError");

    expect(new ThemeVersionError("ocean", "^1.0.0", "2.0.0").code).toBe(
      "THEME_VERSION",
    );
    expect(new ThemeVersionError("ocean", "^1.0.0", "2.0.0").name).toBe(
      "ThemeVersionError",
    );

    expect(new ThemeValidationError([{ path: ["themeId"] }]).code).toBe(
      "THEME_VALIDATION",
    );
    expect(new ThemeValidationError([{ path: ["themeId"] }]).name).toBe(
      "ThemeValidationError",
    );
  });

  it("every raised error extends KernelError and ThemeError (D-22)", () => {
    const raised = [
      new ThemeNotFoundError("ocean"),
      new ThemeCycleError(["a", "b"]),
      new ThemeVersionError("ocean", "^1.0.0", "2.0.0"),
      new ThemeValidationError([{ path: ["themeId"] }]),
    ];

    for (const error of raised) {
      expect(error).toBeInstanceOf(KernelError);
      expect(error).toBeInstanceOf(ThemeError);
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("toJSON() returns { name, code, message, details } with structured details", () => {
    const cycle = new ThemeCycleError(["a", "b"]);
    expect(cycle.toJSON()).toEqual({
      name: "ThemeCycleError",
      code: "THEME_CYCLE",
      message: "Theme inheritance cycle detected: a → b",
      details: { cycle: ["a", "b"] },
    });

    const notFound = new ThemeNotFoundError("ocean");
    expect(notFound.toJSON()).toEqual({
      name: "ThemeNotFoundError",
      code: "THEME_NOT_FOUND",
      message: "Theme not found: ocean",
      details: { themeId: "ocean" },
    });

    const version = new ThemeVersionError("ocean", "^1.0.0", "2.0.0");
    expect(version.toJSON().details).toEqual({
      themeId: "ocean",
      required: "^1.0.0",
      found: "2.0.0",
    });

    const validation = new ThemeValidationError([{ path: ["themeId"] }]);
    expect(validation.toJSON().code).toBe("THEME_VALIDATION");
    expect(validation.toJSON().details.issues).toEqual([{ path: ["themeId"] }]);
  });

  it("ThemeErrorCode is exactly the 7-member union (D-22)", () => {
    expectTypeOf<ThemeErrorCode>().toEqualTypeOf<
      | "THEME_NOT_FOUND"
      | "THEME_CYCLE"
      | "THEME_VERSION"
      | "THEME_VALIDATION"
      | "THEME_COMPATIBILITY"
      | "THEME_AUTHORIZATION"
      | "THEME_INJECTION"
    >();
  });

  it("codes on instances equal union members and toJSON().code matches", () => {
    const errors: ThemeError[] = [
      new ThemeNotFoundError("ocean"),
      new ThemeCycleError(["a", "b"]),
      new ThemeVersionError("ocean", "^1.0.0", "2.0.0"),
      new ThemeValidationError([{ path: ["themeId"] }]),
      new ThemeInjectionError("HTMLElement"),
    ];
    const codes = errors.map((error) => error.code);
    expect(codes).toEqual([
      "THEME_NOT_FOUND",
      "THEME_CYCLE",
      "THEME_VERSION",
      "THEME_VALIDATION",
      "THEME_INJECTION",
    ]);
    for (const error of errors) {
      expect(error.toJSON().code).toBe(error.code);
    }
  });

  it("ThemeInjectionError carries THEME_INJECTION, hostKind detail, KernelError lineage", () => {
    const injection = new ThemeInjectionError("HTMLElement");
    expect(injection.code).toBe("THEME_INJECTION");
    expect(injection.name).toBe("ThemeInjectionError");
    expect(injection).toBeInstanceOf(ThemeError);
    expect(injection).toBeInstanceOf(KernelError);
    expect(injection).toBeInstanceOf(Error);
    expect(injection.toJSON().details.hostKind).toBe("HTMLElement");

    const withCause = new ThemeInjectionError(
      "root style application failed",
      new Error("boom"),
    );
    expect(withCause.toJSON().details.cause).toBe("Error: boom");
  });

  it("declared-only classes construct with their codes (D-21, no raise sites)", () => {
    const compatibility = new ThemeCompatibilityError();
    expect(compatibility.code).toBe("THEME_COMPATIBILITY");
    expect(compatibility).toBeInstanceOf(ThemeError);
    expect(compatibility).toBeInstanceOf(KernelError);

    const authorization = new ThemeAuthorizationError();
    expect(authorization.code).toBe("THEME_AUTHORIZATION");
    expect(authorization).toBeInstanceOf(ThemeError);
    expect(authorization).toBeInstanceOf(KernelError);
  });
});
