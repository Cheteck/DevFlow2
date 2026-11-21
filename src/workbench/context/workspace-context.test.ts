/**
 * @mosaix/workbench — Tests du contexte de travail
 *
 * Couvre : contexte vide (contexte personnel par défaut), contexte avec
 * organisation/projet/entité active, capacités autorisées fournies (non
 * déduites), indépendance vis-à-vis du modèle Space d'IJideals.
 */

import { describe, expect, it } from "vitest";
import { WorkspaceContext, NO_ACTIVE_WORKSPACE } from "@mosaix/workbench/context/workspace-context.js";

describe("Workspace context", () => {
  it("contexte vide représente le contexte personnel par défaut", () => {
    const ctx: WorkspaceContext = {};
    expect(ctx.organizationId).toBeUndefined();
    expect(ctx.projectId).toBeUndefined();
    expect(ctx.activeEntityId).toBeUndefined();
  });

  it("NO_ACTIVE_WORKSPACE est un contexte vide", () => {
    expect(NO_ACTIVE_WORKSPACE).toEqual({});
    expect(Object.keys(NO_ACTIVE_WORKSPACE)).toHaveLength(0);
  });

  it("accepte un contexte organisationnel complet", () => {
    const ctx: WorkspaceContext = {
      organizationId: "org-42",
      projectId: "proj-7",
      activeEntityId: "entity-99",
      activeEntityType: "space",
      authorizedCapabilities: ["commerce:order:read:tenant"],
      locale: "fr",
    };

    expect(ctx.organizationId).toBe("org-42");
    expect(ctx.projectId).toBe("proj-7");
    expect(ctx.activeEntityId).toBe("entity-99");
    expect(ctx.activeEntityType).toBe("space");
    expect(ctx.authorizedCapabilities).toEqual([
      "commerce:order:read:tenant",
    ]);
    expect(ctx.locale).toBe("fr");
  });

  it("ne comporte aucun champ lié au modèle Space d'IJideals", () => {
    const ctx: WorkspaceContext = {
      organizationId: "org",
      projectId: "proj",
    };
    // Aucun champ "spaceId", "spaceName", "spaceBadge" n'est imposé.
    expect("spaceId" in ctx).toBe(false);
    expect("spaceName" in ctx).toBe(false);
    expect("spaceBadge" in ctx).toBe(false);
  });

  it("les capacités autorisées sont une donnée fournie, jamais déduite", () => {
    const ctx: WorkspaceContext = {
      authorizedCapabilities: ["cap:read:tenant"],
    };
    expect(ctx.authorizedCapabilities).toContain("cap:read:tenant");
  });
});
