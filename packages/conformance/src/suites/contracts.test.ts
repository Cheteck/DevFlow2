import { describe, expect, it } from "vitest";
import { CapabilityConformanceSuite } from "./capability.js";
import { EventConformanceSuite } from "./event.js";
import { PermissionConformanceSuite } from "./permission.js";

describe("Contract Conformance Suites", () => {
  describe("CapabilityConformanceSuite", () => {
    it("validates valid capabilities", () => {
      const caps = [
        { id: "commerce.order.create", version: "1.0.0" },
        { id: "citadelle.user.get", version: "2.1.0-alpha" },
      ];
      const res = CapabilityConformanceSuite.validate(caps);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("rejects invalid capabilities missing semver or invalid id pattern", () => {
      const caps = [
        { id: "invalid-id", version: "1.0.0" },
        { id: "valid.domain.action", version: "not-semver" },
      ];
      const res = CapabilityConformanceSuite.validate(caps);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("EventConformanceSuite", () => {
    it("validates valid events", () => {
      const res = EventConformanceSuite.validate({
        name: "mosaix.citadelle.user.created",
        version: "1.0.0",
      });
      expect(res.valid).toBe(true);
    });

    it("rejects events with empty name or invalid semver", () => {
      const res = EventConformanceSuite.validate({
        name: "",
        version: "invalid",
      });
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });
  });

  describe("PermissionConformanceSuite", () => {
    it("validates string and object permissions", () => {
      expect(PermissionConformanceSuite.validate("commerce:order:create:space").valid).toBe(true);
      expect(PermissionConformanceSuite.validate({ key: "imperia:governance:manage:tenant" }).valid).toBe(true);
      expect(PermissionConformanceSuite.validate({ key: "user.write" }).valid).toBe(true);
    });

    it("rejects invalid permissions", () => {
      expect(PermissionConformanceSuite.validate("invalid-perm").valid).toBe(false);
      expect(PermissionConformanceSuite.validate("").valid).toBe(false);
      expect(PermissionConformanceSuite.validate({}).valid).toBe(false);
    });
  });
});
