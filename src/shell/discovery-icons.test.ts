/**
 * Manifest-driven BAC icon tests (navigation declarative).
 *
 * Every BAC owns its icon via `experience.appCard` — the shell never
 * hardcodes one. Engine BACs hide via `showInNavigation: false` instead
 * of shell-side special cases.
 */

import { describe, it, expect, vi } from "vitest";
import * as path from "node:path";
import { ApplicationDiscovery, shellRegistry } from "@mosaix/core";
import {
  resolveManifestIcon,
  isBacVisibleInNavigation,
  parseBacIcon,
  renderBacIcon,
  FALLBACK_BAC_ICON,
  discoverApps,
} from "./discovery.js";

describe("resolveManifestIcon", () => {
  it("returns the manifest icon when valid", () => {
    const warn = vi.fn();
    expect(
      resolveManifestIcon(
        { id: "@apps/x", type: "application", runtime: { entrypoint: "./src/index.ts", isolation: "trusted" }, experience: { appCard: { title: "X", icon: "🚀" } } } as never,
        warn,
      ),
    ).toBe("🚀");
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back with a warning on missing/invalid icons", () => {
    for (const icon of [undefined, "", "   ", "not an icon at all", "a b"]) {
      const warn = vi.fn();
      const got = resolveManifestIcon(
        { id: "@apps/x", type: "application", runtime: { entrypoint: "./src/index.ts", isolation: "trusted" }, experience: { appCard: { title: "X", icon: icon as string } } } as never,
        warn,
      );
      expect(got).toBe(FALLBACK_BAC_ICON);
      expect(warn).toHaveBeenCalledOnce();
    }
  });
});

describe("parseBacIcon (typed syntax)", () => {
  it("accepts emoji, material: names and image files", () => {
    expect(parseBacIcon("🛒")).toEqual({ kind: "emoji", value: "🛒" });
    expect(parseBacIcon("material:storefront")).toEqual({ kind: "material", value: "storefront" });
    expect(parseBacIcon("MATERIAL:StoreFront")).toEqual({ kind: "material", value: "storefront" });
    expect(parseBacIcon("./assets/icon.png")).toEqual({ kind: "image", value: "./assets/icon.png" });
    expect(parseBacIcon("/assets/icon.svg")).toEqual({ kind: "image", value: "/assets/icon.svg" });
    expect(parseBacIcon("https://cdn.example.com/i.ico")).toEqual({ kind: "image", value: "https://cdn.example.com/i.ico" });
  });

  it("rejects unsafe or malformed values", () => {
    for (const raw of [
      "javascript:alert(1).png",
      "data:image/png;base64,AAA",
      "vbscript:x.png",
      "material:not a name!",
      "material:",
      "./assets/icon.txt",
      "https://example.com/icon",
      "has space.png",
      "",
      "a fairly long sentence, definitely not an icon",
      null,
      42,
    ]) {
      expect(parseBacIcon(raw)).toBeNull();
    }
  });

  it("renders safe HTML per kind with escaped payloads", () => {
    expect(renderBacIcon("🛒")).toBe("🛒");
    expect(renderBacIcon("material:storefront")).toContain("material-symbols-outlined");
    expect(renderBacIcon("material:storefront")).toContain("storefront");
    const img = renderBacIcon("/assets/i.png");
    expect(img).toContain("<img");
    expect(img).toContain('src="/assets/i.png"');
    // Unknown values render the fallback, never raw input.
    expect(renderBacIcon("javascript:alert(1)")).toBe(FALLBACK_BAC_ICON);
    expect(renderBacIcon("<img src=x onerror=alert(1)>")).not.toContain("<img");
  });
});

describe("workspace manifests (real apps/ directory)", () => {
  const manifests = ApplicationDiscovery.discoverWorkspaceApps(
    path.resolve(process.cwd(), "apps"),
  );

  it("gives every BAC a valid icon (no silent fallback in production)", () => {
    const offenders = manifests
      .map((m) => ({ id: m.id, icon: m.experience?.appCard?.icon }))
      .filter(({ icon }) => !(typeof icon === "string" && icon.trim().length > 0));
    expect(offenders).toEqual([]);
  });

  it("hides engine BACs via showInNavigation, nothing else", () => {
    const hidden = manifests
      .filter((m) => !isBacVisibleInNavigation(m))
      .map((m) => m.id)
      .sort();
    expect(hidden).toEqual(["@apps/inventory", "@apps/subscription"]);
  });

  it("registers navigation icons from manifests (no hardcoded map)", () => {
    const apps = discoverApps();
    const byId = new Map(apps.map((a) => [a.id.replace(/^@apps\//, ""), a]));
    // Spot-checks: manifest icons win over any shell default.
    expect(byId.get("solara")?.icon).toBe("☀️");
    expect(byId.get("commerce")?.icon).toBe("🏪");
    expect(byId.get("spaces")?.icon).toBe("🪐");
    expect(byId.get("imperia")?.icon).toBe("⚡");
    // Routes still exist for engine BACs, but navigation hides them.
    expect(byId.get("subscription")?.route).toBe("/subscription");
    expect(byId.get("inventory")?.route).toBe("/inventory");
    expect(byId.get("subscription")?.navigable).toBe(false);
    expect(byId.get("inventory")?.navigable).toBe(false);
    expect(byId.get("solara")?.navigable).toBe(true);
    const navIds = shellRegistry.getNavigationItems().map((n) => n.bacId.replace(/^@apps\//, ""));
    expect(navIds).not.toContain("subscription");
    expect(navIds).not.toContain("inventory");
    expect(navIds).toContain("solara");
    // Registry fallback chain stays intact for unknown ids.
    expect(shellRegistry.getIconForBac("nope", "📦")).toBe("📦");
  });
});
