/**
 * @mosaix-plugin/commerce-reviews — Product Reviews Plugin
 */

export interface Review {
  productId: string;
  rating: number;
  comment: string;
  author: string;
}

export class ReviewsPlugin {
  private reviews: Review[] = [];

  addReview(review: Review): void {
    this.reviews.push(review);
  }

  getProductReviews(productId: string): Review[] {
    return this.reviews.filter((r) => r.productId === productId);
  }
}
