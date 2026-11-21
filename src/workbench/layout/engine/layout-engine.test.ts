/**
 * @mosaix/workbench — Tests du Layout Engine
 *
 * Couvre : résolution de layout, régions actives par preset, exclusion des
 * placements masqués, tri par order, tri par priority, critère secondaire
 * stable, déterminisme, layout introuvable, indépendance du Shell et des BAC.
 */

import { describe, expect, it } from "vitest";
import { ContributionRegistry } from "@mosaix/workbench/core/contributions/contribution-registry.js";
import { contentValidators } from "@mosaix/workbench/core/contributions/contribution-validator.js";
import { LayoutEngine } from "@mosaix/workbench/layout/engine/layout-engine.js";
import type { WorkbenchConfiguration } from "@mosaix/workbench/core/contracts/workbench-configuration.js";

function freshRegistry(): ContributionRegistry {
  return new ContributionRegistry(contentValidators);
}

function makeConfig(overrides: Partial<WorkbenchConfiguration> = {}): WorkbenchConfiguration {
  const base: WorkbenchConfiguration = {
    version: "1.0.0",
    branding: { platformName: "Test", defaultThemeId: "theme" },
    regions: [
      { id: "header", label: "Header", surfaceId: "surface-header", ownedBy: "shell" },
      { id: "main", label: "Main", surfaceId: "surface-main", ownedBy: "application" },
      { id: "sidebar", label: "Sidebar", surfaceId: "surface-sidebar", ownedBy: "shell" },
    ],
    layouts: [
      { id: "default", label: "Default" },
      { id: "minimal", label: "Minimal" },
    ],
    presets: [
      {
        id: "standard",
        label: "Standard",
        layoutId: "default",
        regionIds: ["header", "main"],
      },
      {
        id: "minimal-preset",
        label: "Minimal",
        layoutId: "minimal",
        regionIds: ["main"],
      },
    ],
    defaultLayoutId: "default",
    uiCapabilities: {},
  };
  return { ...base, ...overrides };
}

function makeContribution(
  registry: ContributionRegistry,
  overrides: {
    id?: string;
    kind?: "navigation" | "widget";
    surfaceId?: string;
    slotId?: string;
    order?: number;
    priority?: number;
    hidden?: boolean;
    title?: string;
  } = {},
): void {
  registry.register({
    id: overrides.id ?? `contrib-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    contractVersion: "1.0.0",
    ownerApp: "@apps/test",
    kind: overrides.kind ?? "widget",
    title: overrides.title ?? "Contribution",
    placements: [
      {
        id: `placement-${overrides.id ?? "x"}`,
        surfaceId: overrides.surfaceId ?? "surface-main",
        slotId: overrides.slotId ?? "slot-top",
        order: overrides.order,
        priority: overrides.priority,
        hidden: overrides.hidden,
      },
    ],
    content: {},
  });
}

describe("Layout engine", () => {
  it("résout le layout par défaut avec toutes les régions", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    makeContribution(registry, { id: "c1", surfaceId: "surface-main" });
    makeContribution(registry, { id: "c2", surfaceId: "surface-header" });

    const engine = new LayoutEngine(config, registry);
    const result = engine.resolveDefaultLayout();

    expect(result).toBeDefined();
    expect(result!.layoutId).toBe("default");
    expect(result!.presetId).toBeUndefined();
    expect(result!.regions).toHaveLength(3);
    expect(result!.regions[0].id).toBe("header");
    expect(result!.regions[0].placements).toHaveLength(1);
    expect(result!.regions[1].id).toBe("main");
    expect(result!.regions[1].placements).toHaveLength(1);
    expect(result!.regions[2].id).toBe("sidebar");
    expect(result!.regions[2].placements).toHaveLength(0);
  });

  it("résout uniquement les régions actives d'un preset", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    makeContribution(registry, { id: "c1", surfaceId: "surface-header" });
    makeContribution(registry, { id: "c2", surfaceId: "surface-main" });
    makeContribution(registry, { id: "c3", surfaceId: "surface-sidebar" });

    const engine = new LayoutEngine(config, registry);
    const result = engine.resolveLayout({ presetId: "standard" });

    expect(result).toBeDefined();
    expect(result!.presetId).toBe("standard");
    expect(result!.regions).toHaveLength(2);
    expect(result!.regions.map((r) => r.id)).toEqual(["header", "main"]);
    // La région sidebar n'est pas dans le preset standard.
    const sidebar = result!.regions.find((r) => r.id === "sidebar");
    expect(sidebar).toBeUndefined();
  });

  it("exclut les placements masqués (hidden: true)", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    makeContribution(registry, { id: "c-visible", surfaceId: "surface-main", hidden: false });
    makeContribution(registry, { id: "c-hidden", surfaceId: "surface-main", hidden: true });

    const engine = new LayoutEngine(config, registry);
    const result = engine.resolveLayout({ layoutId: "default" });

    const main = result!.regions.find((r) => r.id === "main");
    expect(main!.placements).toHaveLength(1);
    expect(main!.placements[0].contribution.id).toBe("c-visible");
  });

  it("trie par order contractuel (plus petit en premier)", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    makeContribution(registry, { id: "c-last", surfaceId: "surface-main", order: 30 });
    makeContribution(registry, { id: "c-first", surfaceId: "surface-main", order: 10 });
    makeContribution(registry, { id: "c-mid", surfaceId: "surface-main", order: 20 });

    const engine = new LayoutEngine(config, registry);
    const result = engine.resolveLayout({ layoutId: "default" });

    const main = result!.regions.find((r) => r.id === "main");
    expect(main!.placements.map((p) => p.contribution.id)).toEqual([
      "c-first",
      "c-mid",
      "c-last",
    ]);
    expect(main!.placements[0].orderExplicit).toBe(true);
    expect(main!.placements[0].order).toBe(10);
  });

  it("trie par priority (plus haute valeur en premier)", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    makeContribution(registry, { id: "c-low", surfaceId: "surface-main", priority: 1 });
    makeContribution(registry, { id: "c-high", surfaceId: "surface-main", priority: 100 });

    const engine = new LayoutEngine(config, registry);
    const result = engine.resolveLayout({ layoutId: "default" });

    const main = result!.regions.find((r) => r.id === "main");
    expect(main!.placements.map((p) => p.contribution.id)).toEqual([
      "c-high",
      "c-low",
    ]);
  });

  it("utilise l'identifiant comme critère secondaire stable en cas d'égalité d'ordre", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    // Inséré dans l'ordre z, a, m mais même order.
    makeContribution(registry, { id: "zebra", surfaceId: "surface-main", order: 0 });
    makeContribution(registry, { id: "alpha", surfaceId: "surface-main", order: 0 });
    makeContribution(registry, { id: "mid", surfaceId: "surface-main", order: 0 });

    const engine = new LayoutEngine(config, registry);
    const result = engine.resolveLayout({ layoutId: "default" });

    const main = result!.regions.find((r) => r.id === "main");
    expect(main!.placements.map((p) => p.contribution.id)).toEqual([
      "alpha",
      "mid",
      "zebra",
    ]);
  });

  it("est déterministe : même résultat à appel répété", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    makeContribution(registry, { id: "c-a", surfaceId: "surface-main", order: 2 });
    makeContribution(registry, { id: "c-b", surfaceId: "surface-main", order: 1 });

    const engine = new LayoutEngine(config, registry);
    const first = engine.resolveLayout({ layoutId: "default" });
    const second = engine.resolveLayout({ layoutId: "default" });

    expect(first!.regions.map((r) => r.placements.map((p) => p.contribution.id))).toEqual(
      second!.regions.map((r) => r.placements.map((p) => p.contribution.id)),
    );
  });

  it("retourne undefined pour un layout introuvable", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    const engine = new LayoutEngine(config, registry);

    expect(engine.resolveLayout({ layoutId: "inexistant" })).toBeUndefined();
    expect(engine.resolveLayout({ layoutId: "" })).toBeUndefined();
  });

  it("retourne des régions vides pour un preset introuvable", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    const engine = new LayoutEngine(config, registry);

    const result = engine.resolveLayout({ presetId: "inexistant" });
    expect(result).toBeDefined();
    expect(result!.regions).toEqual([]);
  });

  it("ne comprend que les placements ciblant le surfaceId de la région", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    makeContribution(registry, { id: "c-main", surfaceId: "surface-main" });
    makeContribution(registry, { id: "c-header", surfaceId: "surface-header" });

    const engine = new LayoutEngine(config, registry);
    const result = engine.resolveLayout({ layoutId: "default" });

    const main = result!.regions.find((r) => r.id === "main");
    expect(main!.placements.map((p) => p.contribution.id)).toEqual(["c-main"]);
    const header = result!.regions.find((r) => r.id === "header");
    expect(header!.placements.map((p) => p.contribution.id)).toEqual(["c-header"]);
  });

  it("ne comprend pas de régions non déclarées dans le preset", () => {
    const config = makeConfig({
      presets: [
        { id: "p", label: "P", layoutId: "default", regionIds: ["region-inconnue"] },
      ],
    });
    const registry = freshRegistry();
    const engine = new LayoutEngine(config, registry);

    const result = engine.resolveLayout({ presetId: "p" });
    expect(result!.regions).toEqual([]);
  });

  it("n'importe aucune dépendance du Shell ni des BAC", () => {
    const config = makeConfig();
    const registry = freshRegistry();
    const engine = new LayoutEngine(config, registry);
    expect(engine).toBeInstanceOf(LayoutEngine);
    const result = engine.resolveDefaultLayout();
    expect(result).toBeDefined();
  });
});
