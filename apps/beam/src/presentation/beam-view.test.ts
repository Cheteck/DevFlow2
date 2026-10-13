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
  it("renders beam messaging view without fake actions", async () => {
    const descriptor = createBeamDescriptor();
    const result = await descriptor.render!(ctx());

    expect(descriptor.name).toBe("Beam Messaging");
    expect(result.contentHtml).toContain("Discussions");
  });

  it("displays honest messaging for public channel creation in channels view", async () => {
    const descriptor = createBeamDescriptor();
    const result = await descriptor.render!(ctx({ view: "channels" }));

    expect(result.contentHtml).toContain("La création en libre-service de salons publics n'est pas encore activée");
  });
});
