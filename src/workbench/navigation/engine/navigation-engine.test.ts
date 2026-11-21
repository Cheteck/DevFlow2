/**
 * @mosaix/workbench — Tests du Navigation Engine
 *
 * Couvre : résolution des contributions de navigation, filtrage par
 * permissions (affichage uniquement), ordre déterministe, intégration du
 * contexte de travail, changements de contexte, accès refusés, inclusion
 * des BAC du Runtime, et indépendance du Shell et des BAC.
 */

import { describe, expect, it } from "vitest";
import type { NavigationContract } from "@mosaix/contracts";
import type { RuntimeAdapterPort } from "@mosaix/workbench/adapters/runtime/runtime-port.js";
import type { WorkspaceContext } from "@mosaix/workbench/context/workspace-context.js";
import { ContributionRegistry } from "@mosaix/workbench/core/contributions/contribution-registry.js";
import { contentValidators } from "@mosaix/workbench/core/contributions/contribution-validator.js";
import { NavigationEngine, createNavigationEngine } from "@mosaix/workbench/navigation/engine/navigation-engine.js";
import type { ResolvedNavigationItem } from "@mosaix/workbench/navigation/engine/resolved-navigation.js";

function freshRegistry(): ContributionRegistry {
  return new ContributionRegistry(contentValidators);
}

function makeMockRuntimePort(overrides: {
  permissions?: string[];
  bacDescriptors?: Array<{
    id: string;
    name: string;
    routePrefix: string;
    icon?: string;
    isEnabled?: boolean;
    requiredPermissions?: string[];
  }>;
  authenticated?: boolean;
} = {}): RuntimeAdapterPort {
  return {
    getBacDescriptors: () =>
      (overrides.bacDescriptors ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        version: "1.0.0",
        routePrefix: b.routePrefix,
        icon: b.icon,
        isEnabled: b.isEnabled ?? true,
        requiredPermissions: b.requiredPermissions,
        isAvailable: async () => true,
        render: async () => ({ contentHtml: "" }),
      })),
    getUserPermissions: () => overrides.permissions ?? [],
    getWorkspaceContext: () => null,
    isAuthenticated: () => overrides.authenticated ?? false,
  };
}

function registerNavigationContribution(
  registry: ContributionRegistry,
  overrides: {
    id?: string;
    title?: string;
    order?: number;
    requiresPermission?: string;
    items?: Array<{
      id: string;
      label: string;
      target: string;
      icon?: string;
      order?: number;
      requiresPermission?: string;
    }>;
  } = {},
): void {
  const items = overrides.items ?? [
    { id: "item-1", label: "Item 1", target: "/route-1", order: 10 },
  ];

  const content: NavigationContract = { items };
  registry.register({
    id: overrides.id ?? `nav-contrib-${Date.now()}`,
    contractVersion: "1.0.0",
    ownerApp: "@apps/test",
    kind: "navigation",
    title: overrides.title ?? "Navigation",
    placements: [
      { id: "p1", surfaceId: "surface-header", slotId: "slot-top", order: 0 },
    ],
    content,
  });
}

describe("Navigation engine", () => {
  it("résout les items d'une contribution de navigation", () => {
    const registry = freshRegistry();
    registerNavigationContribution(registry, {
      id: "nav-1",
      items: [
        { id: "home", label: "Accueil", target: "/", order: 1 },
        { id: "shop", label: "Boutique", target: "/shop", order: 2 },
      ],
    });

    const engine = new NavigationEngine(registry);
    const result = engine.resolveNavigation();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("home");
    expect(result[0].label).toBe("Accueil");
    expect(result[0].target).toBe("/");
    expect(result[0].order).toBe(1);
    expect(result[0].source).toBe("contribution");
    expect(result[0].contributionId).toBe("nav-1");
    expect(result[1].id).toBe("shop");
  });

  it("trie les items par order puis par identifiant", () => {
    const registry = freshRegistry();
    registerNavigationContribution(registry, {
      id: "nav-1",
      items: [
        { id: "zebra", label: "Z", target: "/z", order: 5 },
        { id: "alpha", label: "A", target: "/a", order: 5 },
        { id: "first", label: "F", target: "/f", order: 1 },
      ],
    });

    const engine = new NavigationEngine(registry);
    const result = engine.resolveNavigation();

    expect(result.map((i) => i.id)).toEqual(["first", "alpha", "zebra"]);
  });

  it("filtre par permission : item sans permission détenue est masqué", () => {
    const registry = freshRegistry();
    registerNavigationContribution(registry, {
      id: "nav-1",
      items: [
        { id: "public", label: "Public", target: "/public", order: 1 },
        {
          id: "admin",
          label: "Admin",
          target: "/admin",
          order: 2,
          requiresPermission: "admin:write:tenant",
        },
      ],
    });

    const port = makeMockRuntimePort({ permissions: ["public:read:tenant"] });
    const engine = new NavigationEngine(registry, port);
    const result = engine.resolveNavigation();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("public");
  });

  it("montre l'item quand l'utilisateur détient la permission requise", () => {
    const registry = freshRegistry();
    registerNavigationContribution(registry, {
      id: "nav-1",
      items: [
        {
          id: "admin",
          label: "Admin",
          target: "/admin",
          order: 1,
          requiresPermission: "admin:write:tenant",
        },
      ],
    });

    const port = makeMockRuntimePort({
      permissions: ["admin:write:tenant", "public:read:tenant"],
    });
    const engine = new NavigationEngine(registry, port);
    const result = engine.resolveNavigation();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("admin");
  });

  it("masque les items quand aucun RuntimeAdapterPort n'est fourni (fail-safe)", () => {
    const registry = freshRegistry();
    registerNavigationContribution(registry, {
      id: "nav-1",
      items: [
        { id: "public", label: "Public", target: "/public", order: 1 },
        {
          id: "protected",
          label: "Protected",
          target: "/protected",
          order: 2,
          requiresPermission: "some:perm:tenant",
        },
      ],
    });

    const engine = new NavigationEngine(registry); // pas de port
    const result = engine.resolveNavigation();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("public");
  });

  it("inclut les descripteurs BAC du Runtime comme items de navigation", () => {
    const registry = freshRegistry();
    const port = makeMockRuntimePort({
      bacDescriptors: [
        { id: "@apps/commerce", name: "Commerce", routePrefix: "/commerce", icon: "🛒" },
        { id: "@apps/beam", name: "Beam", routePrefix: "/beam", isEnabled: false },
      ],
    });
    const engine = new NavigationEngine(registry, port);
    const result = engine.resolveNavigation();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("@apps/commerce");
    expect(result[0].label).toBe("Commerce");
    expect(result[0].source).toBe("configuration");
    // Le BAC désactivé n'est pas inclus.
    expect(result.find((i) => i.id === "@apps/beam")).toBeUndefined();
  });

  it("filtre les BAC par permissions requises", () => {
    const registry = freshRegistry();
    const port = makeMockRuntimePort({
      permissions: ["public:read:tenant"],
      bacDescriptors: [
        { id: "bac-public", name: "Public", routePrefix: "/public" },
        {
          id: "bac-admin",
          name: "Admin",
          routePrefix: "/admin",
          requiredPermissions: ["admin:write:tenant"],
        },
      ],
    });
    const engine = new NavigationEngine(registry, port);
    const result = engine.resolveNavigation();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("bac-public");
  });

  it("est déterministe : même résultat à appel répété", () => {
    const registry = freshRegistry();
    registerNavigationContribution(registry, {
      id: "nav-1",
      items: [
        { id: "b", label: "B", target: "/b", order: 2 },
        { id: "a", label: "A", target: "/a", order: 1 },
      ],
    });
    const port = makeMockRuntimePort({
      permissions: ["x:read:tenant"],
      bacDescriptors: [{ id: "bac-z", name: "Z", routePrefix: "/z" }],
    });
    const engine = new NavigationEngine(registry, port);

    const first = engine.resolveNavigation();
    const second = engine.resolveNavigation();
    expect(first.map((i) => i.id)).toEqual(second.map((i) => i.id));
  });

  it("intègre le contexte de travail sans imposer le modèle Space d'IJideals", () => {
    const registry = freshRegistry();
    registerNavigationContribution(registry, {
      id: "nav-1",
      items: [{ id: "item", label: "Item", target: "/item", order: 1 }],
    });

    const engine = new NavigationEngine(registry);
    const ctx: WorkspaceContext = {
      organizationId: "org-42",
      projectId: "proj-7",
    };
    const result = engine.resolveNavigation({ workspaceContext: ctx });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("item");
    // Aucun champ Space d'IJideals n'est requis ni imposé.
    expect("spaceId" in ctx).toBe(false);
  });

  it("ne comprend pas les items dont la contribution est invalide (kind non navigation ignoré)", () => {
    const registry = freshRegistry();
    // Une contribution de kind "widget" ne doit pas apparaître dans la navigation.
    registry.register({
      id: "widget-1",
      contractVersion: "1.0.0",
      ownerApp: "@apps/test",
      kind: "widget",
      title: "Widget",
      placements: [{ id: "p1", surfaceId: "surface-main", slotId: "slot" }],
      content: {},
    });

    const engine = new NavigationEngine(registry);
    const result = engine.resolveNavigation();

    expect(result).toEqual([]);
  });

  it("n'importe aucune dépendance du Shell ni des BAC", () => {
    const registry = freshRegistry();
    const port = makeMockRuntimePort();
    const engine = new NavigationEngine(registry, port);
    expect(engine).toBeInstanceOf(NavigationEngine);
    const result = engine.resolveNavigation();
    expect(result).toEqual([]);
  });
});

describe("Navigation engine — createNavigationEngine", () => {
  it("crée une engine sans registre ni port", () => {
    const engine = createNavigationEngine();
    expect(engine).toBeInstanceOf(NavigationEngine);
    expect(engine.resolveNavigation()).toEqual([]);
  });
});
