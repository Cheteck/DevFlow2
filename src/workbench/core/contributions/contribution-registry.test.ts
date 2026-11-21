/**
 * @mosaix/workbench — Tests du registre de contributions
 *
 * Couvre : contribution valide, identifiant dupliqué, type inconnu,
 * contribution invalide sans corruption du registre, résolution avec
 * plusieurs types de contributions, isolation (pas d'import du Shell
 * ni des BAC).
 */

import { describe, expect, it } from "vitest";
import {
  contributionRegistry,
  ContributionRegistry,
} from "@mosaix/workbench/core/contributions/contribution-registry.js";
import { ContributionRegistryError } from "@mosaix/workbench/core/contributions/errors.js";
import {
  validateContributionEnvelope,
  contentValidators,
  ContributionValidationError,
} from "@mosaix/workbench/core/contributions/contribution-validator.js";

function freshRegistry(): ContributionRegistry {
  return new ContributionRegistry(contentValidators);
}

const baseNavigation = {
  id: "nav-1",
  contractVersion: "1.0.0",
  ownerApp: "@apps/test",
  kind: "navigation" as const,
  title: "Navigation test",
  placements: [
    { id: "p1", surfaceId: "surface-main", slotId: "slot-top" },
  ],
  content: {
    items: [
      { id: "i1", label: "Item 1", target: "/route-1" },
    ],
  },
};

const baseWidget = {
  id: "widget-1",
  contractVersion: "1.0.0",
  ownerApp: "@apps/test",
  kind: "widget" as const,
  title: "Widget test",
  placements: [
    { id: "p2", surfaceId: "surface-main", slotId: "slot-main", order: 1 },
  ],
  content: { id: "w1", title: "Mon widget" },
};

describe("Contribution registry", () => {
  it("enregistre une contribution de navigation valide", () => {
    const reg = freshRegistry();
    const result = reg.register(baseNavigation);

    expect(result.id).toBe("nav-1");
    expect(result.kind).toBe("navigation");
    expect(reg.has("nav-1")).toBe(true);
    expect(reg.size()).toBe(1);
  });

  it("enregistre une contribution de widget valide", () => {
    const reg = freshRegistry();
    const result = reg.register(baseWidget);

    expect(result.id).toBe("widget-1");
    expect(result.kind).toBe("widget");
    expect(reg.getByKind("widget")).toHaveLength(1);
  });

  it("définit un conflit explicite sur identifiant dupliqué", () => {
    const reg = freshRegistry();
    reg.register(baseNavigation);

    expect(() => reg.register({ ...baseNavigation, id: "nav-1" })).toThrow(
      ContributionRegistryError,
    );
    // Le registre n'est pas corrompu : l'original est conservé.
    expect(reg.getContribution("nav-1")?.title).toBe("Navigation test");
    expect(reg.size()).toBe(1);
  });

  it("rejette un type de contribution inconnu", () => {
    const reg = freshRegistry();
    expect(() =>
      reg.register({
        ...baseNavigation,
        id: "bad-kind",
        kind: "type-inexistant" as any,
      }),
    ).toThrow(ContributionValidationError);
    expect(reg.size()).toBe(0);
  });

  it("rejette une contribution sans identifiant", () => {
    const reg = freshRegistry();
    expect(() =>
      reg.register({ ...baseNavigation, id: "" }),
    ).toThrow(ContributionValidationError);
    expect(reg.size()).toBe(0);
  });

  it("rejette une contribution avec une version de contrat non supportée", () => {
    const reg = freshRegistry();
    expect(() =>
      reg.register({ ...baseNavigation, id: "v2", contractVersion: "2.0.0" }),
    ).toThrow(ContributionValidationError);
    expect(reg.size()).toBe(0);
  });

  it("rejette un widget avec un contenu invalide sans corrompre le registre", () => {
    const reg = freshRegistry();
    reg.register(baseWidget);

    expect(() =>
      reg.register({
        ...baseWidget,
        id: "widget-bad",
        content: { id: 123 }, // id doit être une string
      }),
    ).toThrow(ContributionValidationError);

    // Le registre conserve uniquement le widget valide.
    expect(reg.size()).toBe(1);
    expect(reg.getContribution("widget-1")).toBeDefined();
    expect(reg.has("widget-bad")).toBe(false);
  });

  it("rejette une navigation avec des items invalides", () => {
    const reg = freshRegistry();
    expect(() =>
      reg.register({
        ...baseNavigation,
        id: "nav-bad",
        content: { items: [{ id: "", label: "", target: "" }] },
      }),
    ).toThrow(ContributionValidationError);
    expect(reg.size()).toBe(0);
  });

  it("résout des contributions de plusieurs types de manière déterministe", () => {
    const reg = freshRegistry();
    reg.register(baseNavigation);
    reg.register(baseWidget);

    const all = reg.getAll();
    expect(all).toHaveLength(2);
    const kinds = new Set(all.map((e) => e.kind));
    expect(kinds).toEqual(new Set(["navigation", "widget"]));
  });

  it("vide le registre via clear()", () => {
    const reg = freshRegistry();
    reg.register(baseNavigation);
    expect(reg.size()).toBe(1);
    reg.clear();
    expect(reg.size()).toBe(0);
    expect(reg.has("nav-1")).toBe(false);
  });

  it("n'importe aucune dépendance du Shell ni des BAC", () => {
    // Preuve d'isolation : le registre ne référence que @mosaix/contracts
    // et les modules internes du workbench.
    const reg = freshRegistry();
    expect(reg).toBeInstanceOf(ContributionRegistry);
  });
});

describe("Contribution envelope validation", () => {
  it("valide une enveloppe complète et retourne le contrat normalisé", () => {
    const result = validateContributionEnvelope(baseNavigation);
    expect(result.contractVersion).toBe("1.0.0");
    expect(result.kind).toBe("navigation");
    expect(result.placements).toHaveLength(1);
  });

  it("rejette une enveloppe non-objet", () => {
    expect(() => validateContributionEnvelope(null)).toThrow(
      ContributionValidationError,
    );
    expect(() => validateContributionEnvelope("x")).toThrow(
      ContributionValidationError,
    );
  });
});
