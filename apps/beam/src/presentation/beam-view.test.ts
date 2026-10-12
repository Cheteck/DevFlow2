import { describe, it, expect } from "vitest";
import { createBeamDescriptor } from "./beam-view.js";

function ctx(query: Record<string, string> = {}) {
  return {
    tenantId: "default",
    spaceId: null,
    user: { id: "user-1", roles: ["member"], permissions: [] },
    theme: { mode: "dark" },
    request: { path: "/beam", query, headers: {} },
  } as never;
}

describe("createBeamDescriptor", () => {
  it("renders beam messaging view without alert() callbacks", async () => {
    const descriptor = createBeamDescriptor();
    const result = await descriptor.render!(ctx());

    expect(descriptor.name).toBe("Beam Messaging");
    expect(result.contentHtml).toContain("Discussions");
    expect(result.contentHtml).not.toContain("alert(");
  });

  it("renders channel notification message when channelCreated parameter is provided", async () => {
    const descriptor = createBeamDescriptor();
    const result = await descriptor.render!(ctx({ view: "channels", channelCreated: "true" }));

    expect(result.contentHtml).toContain("Demande de création de salon transmise aux modérateurs.");
    expect(result.contentHtml).not.toContain("alert(");
  });
});
