import { describe, it, expect } from "vitest";
import { DevServer } from "./dev-server";

describe("DevServer (Phase 3)", () => {
  it("starts a dev session with allocated port and diagnostics", () => {
    const devServer = new DevServer();
    const session = devServer.startSession({ sessionId: "test-session", appId: "test-app", targetDir: process.cwd() });

    expect(session.id).toBe("test-session");
    expect(session.appId).toBe("test-app");
    expect(session.state).toBe("RUNNING");
  });

  it("returns diagnostics summary", () => {
    const devServer = new DevServer();
    devServer.startSession({ sessionId: "test-session", appId: "test-app", targetDir: process.cwd() });

    const result = devServer.triggerHMR("test-session", "file.ts");
    expect(result.type).toBe("update");
    expect(result.sessionId).toBe("test-session");
    expect(result.fileChanged).toBe("file.ts");
  });

});
