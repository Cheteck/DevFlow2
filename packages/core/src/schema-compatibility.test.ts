import { describe, it, expect } from "vitest";
import { EventSchemaCompatibility } from "./schema-compatibility";

describe("EventSchemaCompatibility (Phase 6)", () => {
  it("allows compatible minor and patch version increments", () => {
    expect(EventSchemaCompatibility.isCompatible("1.0.0", "1.1.0")).toBe(true);
    expect(EventSchemaCompatibility.isCompatible("1.1.0", "1.1.2")).toBe(true);
  });

  it("detects breaking changes across major version increments", () => {
    expect(EventSchemaCompatibility.isCompatible("1.0.0", "2.0.0")).toBe(false);
  });
});
