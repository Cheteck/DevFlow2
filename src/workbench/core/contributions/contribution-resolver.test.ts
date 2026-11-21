/**
 * @mosaix/workbench — Tests du résolveur de contributions
 *
 * Couvre : déterminisme, respect de l'ordre contractuel (order, priority),
 * critère secondaire stable, filtrage par kind et permissions.
 */

import { describe, expect, it } from "vitest";
import { ContributionRegistry } from "@mosaix/workbench/core/contributions/contribution-registry.js";
import { resolveContributions } from "@mosaix/workbench/core/contributions/contribution-resolver.js";
import { contentValidators } from "@mosaix/workbench/core/contributions/contribution-validator.js";

function freshRegistry(): ContributionRegistry {
  return new ContributionRegistry(contentValidators);
}

const makeNav = (overrides: Record<string, unknown> = {}) => ({
  id: "nav-1",
  contractVersion: "1.0.0",
  ownerApp: "@apps/test",
  kind: "navigation" as const,
  title: "Navigation",
  placements: [{ id: "p1", surfaceId: "s", slotId: "slot" }],
  content: { items: [{ id: "i1", label: "L", target: "/r" }] },
  ...overrides,
});

describe("Contribution resolver", () => {
  it("retourne une liste vide quand aucune contribution n'est enregistrée", () => {
    const reg = freshRegistry();
    const result = resolveContributions(reg);
    expect(result).toEqual([]);
  });

  it("résout une contribution unique", () => {
    const reg = freshRegistry();
    reg.register(makeNav({ id: "nav-a" }));

    const result = resolveContributions(reg);
    expect(result).toHaveLength(1);
    expect(result[0].contribution.id).toBe("nav-a");
  });

  it("respecte l'ordre contractuel (order) des placements", () => {
    const reg = freshRegistry();
    reg.register(makeNav({ id: "nav-last", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 10 }] }));
    reg.register(makeNav({ id: "nav-first", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 1 }] }));
    reg.register(makeNav({ id: "nav-mid", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 5 }] }));

    const result = resolveContributions(reg);
    expect(result.map((r) => r.contribution.id)).toEqual([
      "nav-first",
      "nav-mid",
      "nav-last",
    ]);
    expect(result[0].orderExplicit).toBe(true);
    expect(result[0].order).toBe(1);
  });

  it("respecte la priority (plus haute = affiché en premier)", () => {
    const reg = freshRegistry();
    reg.register(makeNav({ id: "nav-low", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", priority: 1 }] }));
    reg.register(makeNav({ id: "nav-high", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", priority: 100 }] }));

    const result = resolveContributions(reg);
    expect(result.map((r) => r.contribution.id)).toEqual([
      "nav-high",
      "nav-low",
    ]);
  });

  it("utilise un critère secondaire stable (identifiant) en cas d'égalité d'ordre", () => {
    const reg = freshRegistry();
    // Inséré dans l'ordre z, a, m mais même order → tri par identifiant.
    reg.register(makeNav({ id: "nav-zebra", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 0 }] }));
    reg.register(makeNav({ id: "nav-alpha", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 0 }] }));
    reg.register(makeNav({ id: "nav-mid", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 0 }] }));

    const result = resolveContributions(reg);
    expect(result.map((r) => r.contribution.id)).toEqual([
      "nav-alpha",
      "nav-mid",
      "nav-zebra",
    ]);
  });

  it("est déterministe : même résultat à appel répété", () => {
    const reg = freshRegistry();
    reg.register(makeNav({ id: "nav-a", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 2 }] }));
    reg.register(makeNav({ id: "nav-b", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 1 }] }));

    const first = resolveContributions(reg);
    const second = resolveContributions(reg);
    expect(first.map((r) => r.contribution.id)).toEqual(
      second.map((r) => r.contribution.id),
    );
  });

  it("filtre par kind", () => {
    const reg = freshRegistry();
    reg.register(makeNav({ id: "nav-1" }));
    reg.register({
      id: "w1",
      contractVersion: "1.0.0",
      ownerApp: "@apps/test",
      kind: "widget" as const,
      title: "Widget",
      placements: [{ id: "p1", surfaceId: "s", slotId: "slot" }],
      content: {},
    });

    const navs = resolveContributions(reg, { kind: "navigation" });
    expect(navs).toHaveLength(1);
    expect(navs[0].contribution.kind).toBe("navigation");

    const widgets = resolveContributions(reg, { kind: "widget" });
    expect(widgets).toHaveLength(1);
    expect(widgets[0].contribution.kind).toBe("widget");
  });

  it("filtre par permissions requises (filtrage d'affichage)", () => {
    const reg = freshRegistry();
    reg.register(
      makeNav({
        id: "nav-public",
        policies: { requiredPermissions: ["public:read:tenant"] },
      }),
    );
    reg.register(
      makeNav({
        id: "nav-admin",
        policies: { requiredPermissions: ["admin:write:tenant"] },
      }),
    );

    // L'appelant a la permission "public:read:tenant" → nav-public inclus.
    const withPublic = resolveContributions(reg, {
      requiredPermissions: ["public:read:tenant"],
    });
    expect(withPublic.map((r) => r.contribution.id)).toEqual(["nav-public"]);

    // L'appelant a les deux permissions → les deux sont inclus.
    const withBoth = resolveContributions(reg, {
      requiredPermissions: ["public:read:tenant", "admin:write:tenant"],
    });
    expect(withBoth.map((r) => r.contribution.id)).toEqual([
      "nav-admin",
      "nav-public",
    ]);
  });

  it("inclut les contributions sans permissions requises quel que soit le filtre", () => {
    const reg = freshRegistry();
    reg.register(makeNav({ id: "nav-free" }));

    const result = resolveContributions(reg, {
      requiredPermissions: ["any:permission:tenant"],
    });
    expect(result.map((r) => r.contribution.id)).toEqual(["nav-free"]);
  });

  it("ne remplace pas l'ordre métier par un tri alphabétique quand l'ordre est défini", () => {
    const reg = freshRegistry();
    // Inséré z puis a, avec order explicite 2 puis 1.
    reg.register(makeNav({ id: "nav-zebra", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 2 }] }));
    reg.register(makeNav({ id: "nav-alpha", placements: [{ id: "p1", surfaceId: "s", slotId: "slot", order: 1 }] }));

    const result = resolveContributions(reg);
    expect(result.map((r) => r.contribution.id)).toEqual([
      "nav-alpha",
      "nav-zebra",
    ]);
  });
});
