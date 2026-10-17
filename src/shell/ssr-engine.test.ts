/**
 * SSR engine tests: cache correctness (P1), XSS boundaries, valid head
 * composition and accessible mobile drawer.
 */

import { describe, it, expect } from "vitest";
import { renderHeadBlock, renderMobileDrawer } from "./ssr-engine.js";
import { ssrFragmentCache } from "./ssr-cache.js";

const THEME_A = `<style id="mosaix-compiled-theme">:root{--mx-a:1;}</style>`;
const THEME_B = `<style id="mosaix-compiled-theme">:root{--mx-a:2;}</style>`;
const SHARED_A = `.a{color:red;}`;
const SHARED_B = `.b{color:blue;}`;

describe("renderHeadBlock cache key (P1)", () => {
  it("does not return a stale head when style fragments differ", () => {
    ssrFragmentCache.invalidate("head:");
    const first = renderHeadBlock("Page", "dark", THEME_A, SHARED_A);
    const second = renderHeadBlock("Page", "dark", THEME_B, SHARED_A);
    expect(second).not.toBe(first);
    expect(second).toContain("--mx-a:2");
  });

  it("distinguishes sharedStylesHtml as well", () => {
    ssrFragmentCache.invalidate("head:");
    const first = renderHeadBlock("Page", "light", THEME_A, SHARED_A);
    const second = renderHeadBlock("Page", "light", THEME_A, SHARED_B);
    expect(second).not.toBe(first);
    expect(second).toContain(".b{color:blue;}");
  });

  it("distinguishes swapped fragment order (maintenance-gate regression)", () => {
    ssrFragmentCache.invalidate("head:");
    const normal = renderHeadBlock("T", "dark", THEME_A, SHARED_A);
    const swapped = renderHeadBlock("T", "dark", SHARED_A, THEME_A);
    expect(swapped).not.toBe(normal);
  });

  it("hits the cache for identical inputs", () => {
    ssrFragmentCache.invalidate("head:");
    const first = renderHeadBlock("Cached", "dark", THEME_A, SHARED_A);
    const second = renderHeadBlock("Cached", "dark", THEME_A, SHARED_A);
    expect(second).toBe(first);
  });

  it("maps unknown modes to the light bridge variant", () => {
    ssrFragmentCache.invalidate("head:");
    const out = renderHeadBlock("M", "system", THEME_A, SHARED_A);
    expect(out).toContain("rgba(255, 255, 255, 0.7)");
  });
});

describe("renderHeadBlock safety & composition", () => {
  it("returns head INNER content without outer <head> tags", () => {
    const out = renderHeadBlock("T", "dark", THEME_A, SHARED_A);
    expect(out).not.toMatch(/<\/?head[>\s]/);
    expect(out).toContain('<meta charset="UTF-8">');
  });

  it("escapes a malicious page title", () => {
    ssrFragmentCache.invalidate("head:");
    const evil = `"><script>alert(1)</script>`;
    const out = renderHeadBlock(evil, "dark", THEME_A, SHARED_A);
    expect(out).not.toContain(evil);
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("does not restrict viewport zoom (no maximum-scale)", () => {
    const out = renderHeadBlock("T", "dark", THEME_A, SHARED_A);
    expect(out).not.toContain("maximum-scale");
    expect(out).toContain("width=device-width, initial-scale=1.0");
  });

  it("keeps every literal </script> accounted for (no JSON breakout)", () => {
    ssrFragmentCache.invalidate("head:");
    const out = renderHeadBlock("T", "dark", THEME_A, SHARED_A);
    // Only the two legitimate closings: Tailwind CDN + tailwind-config.
    expect(out.match(/<\/script>/g)).toHaveLength(2);
  });
});

describe("renderMobileDrawer accessibility", () => {
  const nav = `<a href="/spaces">Espaces</a>`;
  const out = renderMobileDrawer(nav);

  it("exposes a labelled modal dialog", () => {
    expect(out).toContain('role="dialog"');
    expect(out).toContain('aria-modal="true"');
    expect(out).toContain('aria-label="Menu de navigation mobile"');
  });

  it("implements a full modal interaction cycle in script", () => {
    for (const token of [
      "Escape", // close key
      '"Tab"', // focus trap (quoted key comparison)
      "inert", // background inert
      "overflow", // scroll lock
      "prefers-reduced-motion",
      "generation", // anti-race token
      "aria-hidden",
      "data-drawer-close",
      "mobile-drawer-close",
    ]) {
      expect(out).toContain(token);
    }
  });

  it("supports legacy boolean-less triggers via toggle detection", () => {
    expect(out).toContain("window.toggleMobileDrawer = function");
    expect(out).toContain("isOpen()");
  });

  it("uses no inline onclick handlers", () => {
    expect(out).not.toContain("onclick=");
  });

  it("passes trusted navigation HTML through verbatim", () => {
    expect(out).toContain(nav);
  });

  it("escapes the version label and honours the offline state", () => {
    const evil = renderMobileDrawer(nav, { version: "<img src=x>" });
    expect(evil).not.toContain("<img src=x>");
    expect(evil).toContain("&lt;img src=x&gt;");
    expect(renderMobileDrawer(nav, { online: false })).toContain("Hors ligne");
    expect(renderMobileDrawer(nav)).toContain("En ligne");
  });
});
