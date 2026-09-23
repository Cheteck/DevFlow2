import { describe, it, expect } from "vitest";
import { AppIsolationManager } from "./app-isolation";

describe("AppIsolationManager (Phase 8)", () => {
  it("resolves execution modes based on isolation and engine", () => {
    expect(AppIsolationManager.resolveMode("trusted")).toBe("shared");
    expect(AppIsolationManager.resolveMode("sandbox", "web-worker")).toBe("worker");
    expect(AppIsolationManager.resolveMode("sandbox")).toBe("process");
  });
});
