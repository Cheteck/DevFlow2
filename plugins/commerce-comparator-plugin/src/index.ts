/**
 * @mosaix-plugin/commerce-comparator — Product Comparator Plugin
 */

export class ComparatorPlugin {
  private items: string[] = [];

  addToCompare(productId: string): void {
    if (!this.items.includes(productId)) {
      this.items.push(productId);
    }
  }

  getComparedItems(): string[] {
    return this.items;
  }

  getSlotContribution() {
    return {
      slot: "catalog.product.actions",
    };
  }
}
