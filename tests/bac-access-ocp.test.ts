import { describe, it, expect } from "vitest";
import {
  resolveBacAccess,
  registerBacAccessRule,
} from "../src/shell/bac-access.js";
import type { SsrAuthContext } from "../src/shell/ssr-auth-context.js";

describe("BAC Access Policy OCP Extension", () => {
  it("allows registering custom BAC access rules without modifying bac-access.ts core", () => {
    registerBacAccessRule({
      bacId: "custom_lab",
      anonymousViews: ["public_dashboard"],
      defaultView: "public_dashboard",
      strictViews: ["public_dashboard", "private_dashboard"],
    });

    const anonContext: SsrAuthContext = { kind: "anonymous" };

    const allowedRes = resolveBacAccess(anonContext, "custom_lab", "public_dashboard");
    expect(allowedRes).toEqual({ kind: "allowed" });

    const loginRes = resolveBacAccess(anonContext, "custom_lab", "private_dashboard");
    expect(loginRes).toEqual({ kind: "login" });
  });
});
