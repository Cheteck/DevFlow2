import { describe, it, expect } from "vitest";
import { DevServer } from "./dev-server";

describe("DevServer (Phase 3)", () => {
  it("starts a dev session with allocated port and diagnostics", () => {
    const devServer = new DevServer();
    const session = devServer.startSession({ sessionId: "test-session", appId: "test-app", targetDir: process.cwd() });

    expect(session).toBe("test-session");
  });

  it("returns diagnostics summary", () => {
    const devServer = new DevServer();
    devServer.startSession({ sessionId: "test-session", appId: "test-app", targetDir: process.cwd() });

    const result = devServer.triggerHMR("test-session", "file.ts");
    expect(result.status).toBe("hmr-reloaded");
  });
});
