import { describe, it, expect, vi } from "vitest";
import {
  MosaixApplication,
  createApplication,
  bootstrapApplication,
  type ServiceProvider,
} from "./index.js";

describe("MosaiX Bootstrap Suite (Laravel-inspired)", () => {
  it("registers and boots service providers in proper sequential order", async () => {
    const executionOrder: string[] = [];

    const testProviderA: ServiceProvider = {
      name: "TestProviderA",
      register(app) {
        executionOrder.push("A:register");
        app.setConfig("providerA", true);
      },
      boot(app) {
        executionOrder.push("A:boot");
        app.setService("serviceA", { active: true });
      },
    };

    const testProviderB: ServiceProvider = {
      name: "TestProviderB",
      register(app) {
        executionOrder.push("B:register");
      },
      boot(app) {
        executionOrder.push("B:boot");
      },
    };

    const app = new MosaixApplication();
    app.register(testProviderA).register(testProviderB);

    expect(app.isBooted()).toBe(false);
    await app.boot();
    expect(app.isBooted()).toBe(true);

    // Verify two-phase execution: all registers first, then all boots
    expect(executionOrder).toEqual([
      "A:register",
      "B:register",
      "A:boot",
      "B:boot",
    ]);

    expect(app.getConfig("providerA")).toBe(true);
    expect(app.getService<{ active: boolean }>("serviceA")).toEqual({ active: true });
  });

  it("handles config and service lookup with error fallbacks", () => {
    const app = new MosaixApplication();
    app.setConfig("app.name", "MosaiX");

    expect(app.getConfig("app.name")).toBe("MosaiX");
    expect(app.getConfig("non.existent", "default-val")).toBe("default-val");
    expect(() => app.getConfig("non.existent")).toThrowError(
      "[MosaixApplication] Config key [non.existent] is not set.",
    );

    expect(app.hasService("customService")).toBe(false);
    expect(() => app.getService("customService")).toThrowError(
      "[MosaixApplication] Service [customService] is not registered.",
    );

    app.setService("customService", { id: 123 });
    expect(app.hasService("customService")).toBe(true);
    expect(app.getService<{ id: number }>("customService").id).toBe(123);
  });

  it("creates and boots application via createApplication/bootstrapApplication factory", async () => {
    const providerCalled = vi.fn();
    const mockProvider: ServiceProvider = {
      name: "MockProvider",
      boot() {
        providerCalled();
      },
    };

    const app = await createApplication({
      providers: [mockProvider],
    });

    expect(app.isBooted()).toBe(true);
    expect(providerCalled).toHaveBeenCalledTimes(1);

    expect(bootstrapApplication).toBe(createApplication);
  });

  it("allows setting up HTTP server on application instance", async () => {
    const app = new MosaixApplication();
    const server = app.createServer((_req, res) => {
      res.writeHead(200);
      res.end("OK");
    });

    expect(server).toBeDefined();
    expect(app.server).toBe(server);
  });
});
