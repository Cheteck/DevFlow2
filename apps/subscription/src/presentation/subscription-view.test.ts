import { describe, it, expect } from "vitest";
import { createSubscriptionDescriptor } from "./subscription-view.js";

function ctx(query: Record<string, string> = {}) {
  return {
    tenantId: "default",
    spaceId: null,
    user: { id: "user-1", roles: ["member"], permissions: [] },
    theme: { mode: "dark" },
    request: { path: "/subscription", query, headers: {} },
  } as never;
}

describe("createSubscriptionDescriptor", () => {
  it("renders subscription plans without alert() callbacks", async () => {
    const descriptor = createSubscriptionDescriptor();
    const result = await descriptor.render!(ctx());

    expect(result.contentHtml).toContain("Starter");
    expect(result.contentHtml).toContain("Pro");
    expect(result.contentHtml).toContain("Enterprise");
    expect(result.contentHtml).not.toContain("alert(");
  });

  it("renders selected plan confirmation message when query parameter is provided", async () => {
    const descriptor = createSubscriptionDescriptor();
    const result = await descriptor.render!(ctx({ plan: "Pro" }));

    expect(result.contentHtml).toContain("Votre demande de souscription au forfait <strong>Pro</strong> a été enregistrée avec succès.");
  });
});
