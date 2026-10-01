/**
 * @test Verification of Solara & Portfolio UI SSR View Descriptors
 */

import { describe, it, expect } from "vitest";
import { createSolaraDescriptor } from "@apps/solara";
import { createPortfolioDescriptor } from "@apps/portfolio";

describe("UI View Descriptors Specification Suite", () => {
  describe("Solara View Descriptor (@apps/solara)", () => {
    it("renders Solara feed view with algorithm selectors and composer", async () => {
      const descriptor = createSolaraDescriptor();
      const context = {
        request: { query: { view: "feed", mode: "for_you" } },
        user: { id: "user-test", role: "member", permissions: ["solara:feed:read"] },
        spaceId: undefined,
      };

      const result = await descriptor.render(context as any);
      expect(result.pageTitle).toContain("Solara");
      expect(result.contentHtml).toContain("Pour Toi");
      expect(result.contentHtml).toContain("Tendances");
      expect(result.contentHtml).toContain("Quoi de neuf aujourd'hui");
    });

    it("renders Solara profile view with user info and timeline", async () => {
      const descriptor = createSolaraDescriptor();
      const context = {
        request: { query: { view: "profile" } },
        user: { id: "Alex M.", role: "member", permissions: ["solara:feed:read"] },
      };

      const result = await descriptor.render(context as any);
      expect(result.pageTitle).toContain("Mon Profil");
      expect(result.contentHtml).toContain("Ajouter à la story");
      expect(result.contentHtml).toContain("Alex M.");
    });
  });

  describe("Portfolio View Descriptor (@apps/portfolio)", () => {
    it("renders Portfolio catalog view with vendables grid", async () => {
      const descriptor = createPortfolioDescriptor();
      const context = {
        request: { query: { view: "all" } },
        user: { id: "admin-1", role: "admin", permissions: ["portfolio:vendable:read"] },
      };

      const result = await descriptor.render(context as any);
      expect(result.pageTitle).toContain("Portfolio");
      expect(result.contentHtml).toContain("Portfolio Catalog");
      expect(result.contentHtml).toContain("Catalogue des Vendables");
    });

    it("renders Portfolio dashboard and category tree subviews", async () => {
      const descriptor = createPortfolioDescriptor();

      const dashboardRes = await descriptor.render({
        request: { query: { view: "dashboard" } },
        user: { id: "admin-1" },
      } as any);
      expect(dashboardRes.contentHtml).toContain("Total Vendables");

      const categoriesRes = await descriptor.render({
        request: { query: { view: "categories" } },
        user: { id: "admin-1" },
      } as any);
      expect(categoriesRes.contentHtml).toContain("Arborescence des Catégories");
    });
  });
});
