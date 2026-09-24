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

  it("handles agnostic vendable offers for spaces, tenants, and creators", async () => {
    const { CommerceOfferService } = await import("./domain/commerce-offer.model.js");
    const service = new CommerceOfferService();

    // 1. Space creates an offer for a vendable item
    const spaceOffer = await service.createOffer({
      seller: { type: "space", id: "space-artisanat-kabyle", name: "Artisanat Kabyle" },
      vendableId: "vend-pottery-01",
      title: "Poterie Traditionnelle Kabyle",
      priceInCents: 4500, // 45.00 EUR
      currency: "EUR",
      stockAllocation: 15,
      commissionRateBps: 500, // 5% platform commission
      payoutDestination: { provider: "stripe_connect", accountId: "acct_space_123" },
    });

    expect(spaceOffer.id).toBeDefined();
    expect(spaceOffer.seller.type).toBe("space");
    expect(spaceOffer.seller.id).toBe("space-artisanat-kabyle");
    expect(spaceOffer.status).toBe("ACTIVE");

    // 2. Individual creator creates an offer for the same or different vendable item
    const creatorOffer = await service.createOffer({
      seller: { type: "user", id: "usr-karim", name: "Karim Potter" },
      vendableId: "vend-pottery-01",
      title: "Poterie Faite Main - Karim",
      priceInCents: 4200,
      currency: "EUR",
      commissionRateBps: 700, // 7% platform commission
    });

    expect(creatorOffer.seller.type).toBe("user");

    // 3. Query offers by seller
    const spaceOffers = await service.listOffersBySeller("space", "space-artisanat-kabyle");
    expect(spaceOffers).toHaveLength(1);
    expect(spaceOffers[0].id).toBe(spaceOffer.id);

    // 4. Query active offers for a specific vendable
    const vendableOffers = await service.listActiveOffersForVendable("vend-pottery-01");
    expect(vendableOffers).toHaveLength(2);

    // 5. Calculate payout breakdown with platform commission
    const payout = service.calculatePayout(spaceOffer, 2); // 2 units = 90.00 EUR
    expect(payout.grossAmountInCents).toBe(9000);
    expect(payout.platformCommissionInCents).toBe(450); // 5% of 9000 = 450
    expect(payout.netSellerPayoutInCents).toBe(8550); // 9000 - 450 = 8550
  });
});

