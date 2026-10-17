import { describe, it, expect } from "vitest";
import type * as http from "node:http";
import { handleMaintenanceGate } from "./maintenance-gate.js";

describe("handleMaintenanceGate (DI)", () => {
  it("uses the injected maintenance service when active", () => {
    const fakeService = {
      isMaintenanceActive: () => true,
      isUserBypassed: () => false,
      getMaintenanceStatus: () => ({ reason: "test", estimatedDurationMinutes: 5 }),
    };
    const req = {} as http.IncomingMessage;
    const res = { writeHead: () => {}, end: () => {} } as unknown as http.ServerResponse;
    const result = handleMaintenanceGate(req, res, "/foo", "guest", "light" as any, "", fakeService as any);
    expect(result).toBe(true);
  });
});