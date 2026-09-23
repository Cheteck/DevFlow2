/**
 * @mosaix-plugin/commerce-wishlist — Product Wishlist Plugin
 */

export class WishlistPlugin {
  private favorites = new Set<string>();

  addFavorite(productId: string): void {
    this.favorites.add(productId);
  }

  isFavorite(productId: string): boolean {
    return this.favorites.has(productId);
  }
}
