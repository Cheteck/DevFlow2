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

/* AUDIT-RESET a055b8e (2026-10-13) — AUCUNE PERTE DÉTECTÉE.
 * Les deux cas ont été réécrits en cohérence avec beam-view.ts (plus de query channelCreated, assertion
 * sur le message honnête). Relancer cette suite après toute restauration d'un parcours de création. */
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
