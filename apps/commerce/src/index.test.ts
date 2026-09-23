import { describe, expect, it } from "vitest";
import { ComparatorPlugin } from "@mosaix-plugin/commerce-comparator";
import { WishlistPlugin } from "@mosaix-plugin/commerce-wishlist";
import { ReviewsPlugin } from "@mosaix-plugin/commerce-reviews";
import { RecentlyViewedPlugin } from "@mosaix-plugin/commerce-recently-viewed";
import { BadgePlugin } from "@mosaix-plugin/commerce-badge";

describe("Commerce App Plugins Integration Suite", () => {
  it("integrates ComparatorPlugin", () => {
    const comparator = new ComparatorPlugin();
    comparator.addToCompare("prod-1");
    comparator.addToCompare("prod-2");

    expect(comparator.getComparedItems()).toEqual(["prod-1", "prod-2"]);
    expect(comparator.getSlotContribution().slot).toBe("catalog.product.actions");
  });

  it("integrates WishlistPlugin", () => {
    const wishlist = new WishlistPlugin();
    wishlist.addFavorite("prod-1");

    expect(wishlist.isFavorite("prod-1")).toBe(true);
    expect(wishlist.isFavorite("prod-2")).toBe(false);
  });

  it("integrates ReviewsPlugin", () => {
    const reviews = new ReviewsPlugin();
    reviews.addReview({ productId: "prod-1", rating: 5, comment: "Great!", author: "User1" });

    expect(reviews.getProductReviews("prod-1")).toHaveLength(1);
    expect(reviews.getProductReviews("prod-1")[0].rating).toBe(5);
  });

  it("integrates RecentlyViewedPlugin", () => {
    const recent = new RecentlyViewedPlugin();
    recent.trackView("prod-1");
    recent.trackView("prod-2");

    expect(recent.getRecentViews()).toEqual(["prod-2", "prod-1"]);
  });

  it("integrates BadgePlugin", () => {
    const badge = new BadgePlugin();
    expect(badge.getBadgeLabel("new")).toBe("Nouveau");
    expect(badge.getBadgeLabel("promo")).toBe("Promo -20%");
  });
});
