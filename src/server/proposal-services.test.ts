import { describe, it, expect, vi } from "vitest";
import type * as http from "node:http";
import type { URL } from "node:url";
import { dispatchApiRequest } from "./api-dispatcher.js";

describe("dispatchApiRequest proposal services (OCP)", () => {
  it("uses injected proposal services builder", async () => {
    const handleSpacesProposalRoutes = vi.fn(async () => true);
    // monkeypatch module-level handler via context builder
    const builder = vi.fn(() => ({
      portfolioService: {} as any,
      proposalService: {} as any,
    }));
    const req = { method: "POST" } as http.IncomingMessage;
    const res = { writeHead: () => {}, end: () => {} } as unknown as http.ServerResponse;
    const parsedUrl = new URL("http://localhost/api/spaces/s1/proposals") as URL;
    const ctx = {
      activeMode: "light",
      currentUser: { id: "u1", role: "user" },
      compositionOverrideManager: {},
      feedService: {},
      eventBackplane: {},
      anonymizationOrchestrator: {},
      db: {},
      buildProposalServices: builder,
    } as any;
    await dispatchApiRequest(req, res, parsedUrl, ctx);
    expect(builder).toHaveBeenCalledWith(ctx.db);
  });
});