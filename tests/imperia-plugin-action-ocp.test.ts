import { describe, it, expect } from "vitest";
import type { HttpRequest } from "@mosaix/sdk";
import {
  ImperiaGovernanceController,
} from "../apps/imperia/src/infrastructure/imperia-controller.js";
import {
  registerPluginAction,
} from "../apps/imperia/src/domain/plugin-manager.service.js";

describe("Imperia Governance Plugin Action OCP Extension", () => {
  it("allows registering custom plugin actions without modifying executePluginAction", async () => {
    registerPluginAction("sync_manifest", (_pluginId, _manager) => {
      return {
        id: "p1",
        name: "Synced Plugin",
        version: "1.0.0",
        author: "Mosaix",
        category: "commerce",
        description: "Synced",
        installed: true,
        enabled: true,
        configurable: false,
      };
    });

    const controller = new ImperiaGovernanceController();
    const mockReq: Partial<HttpRequest> = {
      principal: { sub: "admin", roles: ["admin"], permissions: [] },
      body: {
        pluginId: "p1",
        action: "sync_manifest",
      },
    };

    const res = await controller.executePluginAction(mockReq as HttpRequest);
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.body)).toContain("sync_manifest");
  });
});
