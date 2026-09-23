import { describe, it, expect } from "vitest";
import { MosaixDevServer } from "./dev-server/dev-server.js";
import { MosaixDevWatcher } from "./dev-server/watcher.js";
import { MosaixCommandRouter } from "./command-router.js";

describe("MosaixDevServer Engine", () => {
  const rootDir = process.cwd();

  it("should discover apps and plugins and return valid diagnostics", async () => {
    const server = new MosaixDevServer(rootDir, { port: 3000 });
    const result = await server.start({ json: true });

    expect(result.exitCode).toBe(0);
    expect(result.message).toContain("MosaiX Dev Server started");
    expect(result.data).toBeDefined();

    const diagnostics = server.getDiagnostics();
    expect(diagnostics.port).toBe(3000);
    expect(diagnostics.discoveredApps).toContain("citadelle");
    expect(diagnostics.discoveredApps).toContain("imperia");
    expect(diagnostics.conformancePassed).toBe(true);
  });

  it("should filter applications when app option is provided", async () => {
    const server = new MosaixDevServer(rootDir, { port: 3001, app: "imperia" });
    const result = await server.start({ json: true });

    expect(result.exitCode).toBe(0);
    const data = result.data as { discoveredApps: string[]; activeAppFilter: string };
    expect(data.discoveredApps).toEqual(["imperia"]);
    expect(data.activeAppFilter).toBe("imperia");
  });

  it("should return error code when target app does not exist", async () => {
    const server = new MosaixDevServer(rootDir, { port: 3002, app: "nonexistent-app" });
    const result = await server.start({ json: true });

    expect(result.exitCode).not.toBe(0);
    expect(result.message).toContain("not found");
  });

  it("should create watcher without errors", () => {
    const watcher = new MosaixDevWatcher(rootDir);
    expect(watcher).toBeDefined();
    watcher.stop();
  });

  it("should execute mosaix dev via MosaixCommandRouter", async () => {
    const router = new MosaixCommandRouter(rootDir);
    const result = await router.execute("dev", { json: true, args: ["--port", "4000", "--app", "imperia"] });

    expect(result.exitCode).toBe(0);
    const data = result.data as { port: number; discoveredApps: string[] };
    expect(data.port).toBe(4000);
    expect(data.discoveredApps).toEqual(["imperia"]);
  });
});
