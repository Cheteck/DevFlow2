import { describe, it, expect } from "vitest";
import { getCtaConfig, registerCtaConfig } from "./renderer.js";

describe("getCtaConfig (OCP registry)", () => {
  it("returns the commerce CTA for commerce bac", () => {
    const cta = getCtaConfig("commerce");
    expect(cta.label).toBe("Voir Panier");
    expect(cta.icon).toBe("shopping_cart");
  });

  it("returns the default CTA for an unknown bac", () => {
    const cta = getCtaConfig("does-not-exist");
    expect(cta.label).toBe("Action Rapide");
    expect(cta.icon).toBe("bolt");
  });

  it("honours a customLabel override", () => {
    const cta = getCtaConfig("commerce", "Mon label");
    expect(cta.label).toBe("Mon label");
  });

  it("allows registering a new bac without modifying getCtaConfig", () => {
    registerCtaConfig("newbac", (customLabel) => ({
      label: customLabel || "Nouveau BAC",
      icon: "star",
      action: "window.location.href='/newbac';",
    }));
    const cta = getCtaConfig("newbac");
    expect(cta.label).toBe("Nouveau BAC");
    expect(cta.icon).toBe("star");
  });
});
