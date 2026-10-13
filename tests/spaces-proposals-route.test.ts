import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { handleSpacesProposalRoutes } from "../src/server/routes/spaces-routes.js";

/* AUDIT-RESET a055b8e (2026-10-13) — FICHIER PERDU PUIS RESTAURÉ (V1.3, voir git log).
 * La session annonçait ce test SELL-FLOW-02 ; ni lui ni spaces-routes.ts n'existaient
 * (ni suivis ni dans l'arbre). Restaurés ensemble + wiring api-dispatcher. */

function fakeReq(method: string, url: string, body?: string): IncomingMessage {
  const stream = new Readable({
    read() {
      if (body !== undefined) {
        this.push(body);
      }
      this.push(null);
    },
  });
  return Object.assign(stream, {
    method,
    url,
    headers: { host: "localhost:3000" },
  }) as unknown as IncomingMessage;
}

function fakeRes(): { res: ServerResponse; output: { statusCode: number; body: string } } {
  const output = { statusCode: 0, body: "" };
  const res = {
    writeHead: (statusCode: number) => {
      output.statusCode = statusCode;
    },
    end: (chunk?: unknown) => {
      output.body = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
    },
  } as unknown as ServerResponse;
  return { res, output };
}

const AUTH = { currentUserId: "usr-seller-1" };

function serviceStub() {
  return {
    createDraft: vi.fn(async (spaceId: string, userId: string, input: { suggestedReference: string }) => ({
      id: "prop_test_1",
      spaceId,
      proposerUserId: userId,
      suggestedReference: input.suggestedReference,
      status: "Draft",
    })),
  };
}

describe("POST /api/spaces/:spaceId/proposals (SELL-FLOW-02)", () => {
  it("ignores non-proposal paths", async () => {
    const { res } = fakeRes();
    const handled = await handleSpacesProposalRoutes(
      fakeReq("POST", "/api/spaces"),
      res,
      new URL("http://localhost/api/spaces"),
      { ...AUTH, proposalService: serviceStub() },
    );
    expect(handled).toBe(false);
  });

  it("rejects non-POST methods", async () => {
    const { res, output } = fakeRes();
    const handled = await handleSpacesProposalRoutes(
      fakeReq("GET", "/api/spaces/space-1/proposals"),
      res,
      new URL("http://localhost/api/spaces/space-1/proposals"),
      { ...AUTH, proposalService: serviceStub() },
    );
    expect(handled).toBe(true);
    expect(output.statusCode).toBe(405);
  });

  it("requires authentication (guest → 401)", async () => {
    const { res, output } = fakeRes();
    const handled = await handleSpacesProposalRoutes(
      fakeReq("POST", "/api/spaces/space-1/proposals", "{}"),
      res,
      new URL("http://localhost/api/spaces/space-1/proposals"),
      { currentUserId: "guest", proposalService: serviceStub() },
    );
    expect(handled).toBe(true);
    expect(output.statusCode).toBe(401);
  });

  it("rejects malformed JSON and invalid bodies", async () => {
    for (const body of ["not-json{", JSON.stringify({}), JSON.stringify({ suggestedReference: "X", type: "Nope" })]) {
      const { res, output } = fakeRes();
      const handled = await handleSpacesProposalRoutes(
        fakeReq("POST", "/api/spaces/space-1/proposals", body),
        res,
        new URL("http://localhost/api/spaces/space-1/proposals"),
        { ...AUTH, proposalService: serviceStub() },
      );
      expect(handled).toBe(true);
      expect(output.statusCode).toBe(400);
    }
  });

  it("creates a Draft and returns 201 with the path spaceId", async () => {
    const proposalService = serviceStub();
    const { res, output } = fakeRes();
    const handled = await handleSpacesProposalRoutes(
      fakeReq(
        "POST",
        "/api/spaces/space-caj-jijel/proposals",
        JSON.stringify({ suggestedReference: "XIAOMI-18", type: "Product" }),
      ),
      res,
      new URL("http://localhost/api/spaces/space-caj-jijel/proposals"),
      { ...AUTH, proposalService },
    );
    expect(handled).toBe(true);
    expect(output.statusCode).toBe(201);
    expect(proposalService.createDraft).toHaveBeenCalledOnce();
    const [spaceId, userId, input] = proposalService.createDraft.mock.calls[0] as unknown as [
      string,
      string,
      { suggestedReference: string },
    ];
    expect(spaceId).toBe("space-caj-jijel");
    expect(userId).toBe("usr-seller-1");
    expect(input.suggestedReference).toBe("XIAOMI-18");
    expect(JSON.parse(output.body)).toMatchObject({ id: "prop_test_1", status: "Draft" });
  });
});
