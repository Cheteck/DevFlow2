/**
 * Spaces descriptor tests: real service data, public projection for guests.
 * No static spaces or members — empty stores render empty states, and the
 * member directory never renders for anonymous visitors (nor emails ever).
 */

import { describe, it, expect } from "vitest";
import { createSpacesDescriptor, toPublicSpace } from "./spaces-view";
import { SpaceService } from "../domain/space.model.js";

function ctx(query: Record<string, string | string[]>, roles: string[] = ["member"]) {
  return {
    tenantId: "default",
    spaceId: null,
    user: { id: "user-1", roles, permissions: [] },
    theme: { mode: "dark" },
    request: { path: "/spaces", query, headers: {} },
  } as never;
}

async function seededService() {
  const service = new SpaceService();
  await service.createSpaceFromTemplate("Atelier Test", "store", "owner-1", "tenant-1");
  return service;
}

describe("toPublicSpace", () => {
  it("exposes presentation fields only", () => {
    const pub = toPublicSpace({
      id: "s1", name: "N", slug: "n", category: "c", template: "store",
      ownerId: "o", tenantId: "t", subscriptionPlan: "free", followersCount: 7,
      team: [], enabledCapabilities: [], publicNavigation: [], createdAt: new Date(),
    });
    expect(pub).toEqual({ id: "s1", name: "N", slug: "n", category: "c", followersCount: 7 });
    expect(pub).not.toHaveProperty("ownerId");
    expect(pub).not.toHaveProperty("team");
  });
});

describe("createSpacesDescriptor", () => {
  it("lists real spaces with profile links", async () => {
    const descriptor = createSpacesDescriptor({ spaceService: await seededService() });
    const result = await descriptor.render!(ctx({}));
    expect(result.contentHtml).toContain("Atelier Test");
    expect(result.contentHtml).toContain("view=profile");
    expect(result.contentHtml).not.toContain("Chambre d'Agriculture");
    expect(result.contentHtml).not.toContain("Tech Startup Hub");
  });

  it("renders an honest empty state without a service", async () => {
    const descriptor = createSpacesDescriptor();
    const result = await descriptor.render!(ctx({}));
    expect(result.contentHtml).toContain("Aucun espace pour le moment");
  });

  it("hides the member directory and management from guests", async () => {
    const descriptor = createSpacesDescriptor({ spaceService: await seededService() });
    const guest = ctx({ view: "profile" }, []);
    const guestHtml = (await descriptor.render!(guest)).contentHtml;
    expect(guestHtml).not.toContain("Annuaire des Membres");
    expect(guestHtml).not.toContain("Gérer l'Espace");
    expect(guestHtml).not.toContain("Inviter membre");
    expect(guestHtml).not.toContain("@mosaix");

    const memberHtml = (await descriptor.render!(ctx({ view: "profile" }))).contentHtml;
    expect(memberHtml).toContain("Annuaire des Membres");
    expect(memberHtml).not.toContain("@mosaix");
  });

  it("prompts login for space creation as guest", async () => {
    const descriptor = createSpacesDescriptor();
    const result = await descriptor.render!(ctx({ view: "new" }, []));
    expect(result.contentHtml).toContain("Se connecter");
  });
});
