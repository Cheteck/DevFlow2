import { describe, it, expect } from "vitest";
import {
  EventConformanceSuite,
  PermissionConformanceSuite,
  PluginConformanceSuite,
  TenantConformanceSuite,
  RuntimeConformanceSuite,
  SessionConformanceSuite,
  RouteConformanceSuite,
  PlatformConformanceSuite,
  SecurityConformanceSuite,
  AuthConformanceSuite,
  ThemeConformanceSuite,
  KernelConformanceSuite,
} from "./index";

describe("MosaiX Conformance Suites", () => {
  it("validates event suite", () => {
    expect(EventConformanceSuite.validate({ name: "UserCreated" }).valid).toBe(true);
    expect(EventConformanceSuite.validate({}).valid).toBe(false);
  });

  it("validates permission suite", () => {
    expect(PermissionConformanceSuite.validate({ key: "user.write" }).valid).toBe(true);
    expect(PermissionConformanceSuite.validate({}).valid).toBe(false);
  });

  it("validates plugin suite", () => {
    expect(PluginConformanceSuite.validate({ id: "plugin-1" }).valid).toBe(true);
  });

  it("validates tenant suite", () => {
    expect(TenantConformanceSuite.validate({ tenantId: "tenant-99" }).valid).toBe(true);
  });

  it("validates runtime suite", () => {
    expect(RuntimeConformanceSuite.validate({ status: "active" }).valid).toBe(true);
  });

  it("validates session suite", () => {
    expect(SessionConformanceSuite.validate({ sessionId: "sess-1" }).valid).toBe(true);
  });

  it("validates route suite", () => {
    expect(RouteConformanceSuite.validate({ path: "/api/v1" }).valid).toBe(true);
  });

  it("validates platform suite", () => {
    expect(PlatformConformanceSuite.validate({ version: "1.0.0" }).valid).toBe(true);
  });

  it("validates security suite", () => {
    expect(SecurityConformanceSuite.validate({ name: "strict-rbac" }).valid).toBe(true);
  });

  it("validates auth suite", () => {
    expect(AuthConformanceSuite.validate({ userId: "usr-123" }).valid).toBe(true);
  });

  it("validates theme suite", () => {
    expect(ThemeConformanceSuite.validate({ name: "dark" }).valid).toBe(true);
  });

  it("validates kernel suite", () => {
    expect(KernelConformanceSuite.validate({ kernelVersion: "2.0.0" }).valid).toBe(true);
  });
});
