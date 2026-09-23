/**
 * @mosaix-plugin/commerce-recently-viewed — Recently Viewed Products Plugin
 */

export class RecentlyViewedPlugin {
  private views: string[] = [];

  trackView(productId: string): void {
    const idx = this.views.indexOf(productId);
    if (idx !== -1) {
      this.views.splice(idx, 1);
    }
    this.views.unshift(productId);
  }

  getRecentViews(): string[] {
    return this.views;
  }
}
