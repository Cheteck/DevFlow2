/**
 * Drawer exclusivity guard (ADR-0022) : aucune page servie ne doit inclure
 * les DEUX implémentations de tiroir mobile (`ssr-engine.ts` slide-over et
 * `renderer.ts` bottom-sheet) — mêmes `id` DOM et global
 * `toggleMobileDrawer` homonyme qui se neutraliseraient.
 */

import { describe, it, expect } from "vitest";
import { renderHomePage } from "./pages/home-page.js";
import { renderBacPage } from "./pages/bac-page.js";
import { USER_PROFILES } from "./profiles.js";

const MEMBER = USER_PROFILES.member;

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("home page", () => {
  const html = renderHomePage({
    activeMode: "dark",
    sharedStyles: ".x{}",
    currentUser: MEMBER,
    currentSpace: null,
    feedPosts: [],
    widgetsHtml: "",
  });

  it("includes only the renderer bottom-sheet drawer", () => {
    expect(countOccurrences(html, 'id="mobile-drawer"')).toBe(1);
  });

  it("does not include the ssr-engine slide-over drawer", () => {
    expect(html).not.toContain("mobile-drawer-container");
  });

  it("defines a single toggleMobileDrawer global", () => {
    expect(
      countOccurrences(html, "window.toggleMobileDrawer = function"),
    ).toBeLessThanOrEqual(1);
  });
});

describe("bac page", () => {
  const html = renderBacPage({
    activeMode: "dark",
    sharedStyles: ".x{}",
    themeStyle: "<style>/*t*/</style>",
    matchedApp: {
      id: "commerce",
      name: "Boutique",
      route: "/commerce",
      category: "Vente",
    },
    currentUser: MEMBER,
    currentSpace: null,
    renderedContent: "<p>ok</p>",
  });

  it("includes only the renderer bottom-sheet drawer", () => {
    expect(countOccurrences(html, 'id="mobile-drawer"')).toBe(1);
  });

  it("does not include the ssr-engine slide-over drawer", () => {
    expect(html).not.toContain("mobile-drawer-container");
  });

  it("defines a single toggleMobileDrawer global", () => {
    expect(
      countOccurrences(html, "window.toggleMobileDrawer = function"),
    ).toBeLessThanOrEqual(1);
  });
});
