import { describe, it, expect } from "vitest";
import {
  createPortfolioView,
  registerPortfolioSubView,
} from "../apps/portfolio/src/presentation/portfolio-view.js";

describe("Portfolio Presentation Views OCP Extension", () => {
  it("allows registering custom subviews for Portfolio BAC without modifying createPortfolioView", async () => {
    registerPortfolioSubView("supplier_feed", async (_context) => {
      return `<div class="custom-supplier-view">Supplier Feed SubView</div>`;
    });

    const view = createPortfolioView();
    const result = await view.render({
      query: { view: "supplier_feed" },
    });

    expect(result.contentHtml).toContain("Supplier Feed SubView");
    expect(result.pageTitle).toContain("Portfolio");
  });
});
