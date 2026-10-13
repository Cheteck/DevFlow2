import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { handleSpacesProposalRoutes } from "../src/server/routes/spaces-routes.js";

/* AUDIT-RESET a055b8e (2026-10-13) — FICHIER PERDU PUIS RESTAURÉ (V1.3, voir git log).
 * La session annonçait ce test SELL-FLOW-02 ; ni lui ni spaces-routes.ts n'existaient
 * (ni suivis ni dans l'arbre). Restaurés ensemble + wiring api-dispatcher. */

function fakeReq(method: string, url: string, body?: string, headers: Record<string, string> = {}): IncomingMessage {
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
    headers: { host: "localhost:3000", ...headers },
  }) as unknown as IncomingMessage;
}

function fakeRes(): { res: ServerResponse; output: { statusCode: number; body: string; location?: string } } {
  const output = { statusCode: 0, body: "", location: undefined as string | undefined };
  const res = {
    writeHead: (statusCode: number, responseHeaders?: Record<string, string>) => {
      output.statusCode = statusCode;
      if (responseHeaders?.Location) output.location = responseHeaders.Location;
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

  it("accepts urlencoded browser forms and maps price/stock (V2.1)", async () => {
    const proposalService = serviceStub();
    const { res, output } = fakeRes();
    const form = new URLSearchParams({
      name: "Xiaomi 18",
      reference: "XIAOMI-18",
      type: "Product",
      price: "450.00",
      currency: "EUR",
      stock: "10",
    }).toString();
    const handled = await handleSpacesProposalRoutes(
      fakeReq("POST", "/api/spaces/space-1/proposals", form, {
        "content-type": "application/x-www-form-urlencoded",
      }),
      res,
      new URL("http://localhost/api/spaces/space-1/proposals"),
      { ...AUTH, proposalService },
    );
    expect(handled).toBe(true);
    expect(output.statusCode).toBe(201);
    const [, , input] = proposalService.createDraft.mock.calls[0] as unknown as [
      string,
      string,
      { content: { fr: { name: string }; commercialTerms: { priceInCents: number } }; characteristics: { stockAllocation: number } },
    ];
    expect(input.content.fr.name).toBe("Xiaomi 18");
    expect(input.content.commercialTerms).toMatchObject({ priceInCents: 45000, currency: "EUR" });
    expect(input.characteristics.stockAllocation).toBe(10);
  });

  it("redirects browser forms to the sell view with the draft id (V2.1)", async () => {
    const { res, output } = fakeRes();
    const form = new URLSearchParams({ reference: "X", type: "Product" }).toString();
    const handled = await handleSpacesProposalRoutes(
      fakeReq("POST", "/api/spaces/space-9/proposals", form, {
        "content-type": "application/x-www-form-urlencoded",
        accept: "text/html",
      }),
      res,
      new URL("http://localhost/api/spaces/space-9/proposals"),
      { ...AUTH, proposalService: serviceStub() },
    );
    expect(handled).toBe(true);
    expect(output.statusCode).toBe(303);
    expect(output.location).toContain("/spaces?view=sell&space=space-9&submitted=prop_test_1");
  });

  it("rejects invalid form prices and stocks (V2.1)", async () => {
    for (const extra of ["price=-5", "price=abc", "stock=-1", "stock=2.5"]) {
      const { res, output } = fakeRes();
      const handled = await handleSpacesProposalRoutes(
        fakeReq("POST", "/api/spaces/space-1/proposals", `reference=X&type=Product&${extra}`, {
          "content-type": "application/x-www-form-urlencoded",
        }),
        res,
        new URL("http://localhost/api/spaces/space-1/proposals"),
        { ...AUTH, proposalService: serviceStub() },
      );
      expect(handled).toBe(true);
      expect(output.statusCode).toBe(400);
    }
  });
});
