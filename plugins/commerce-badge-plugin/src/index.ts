/**
 * @mosaix-plugin/commerce-badge — Product Badge Plugin
 */

export interface BadgePluginOptions {
  badgeLabels?: Record<string, string>;
}

export class BadgePlugin {
  private readonly badgeLabels: Record<string, string>;

  constructor(options: BadgePluginOptions = {}) {
    this.badgeLabels = {
      new: "Nouveau",
      promo: "Promo -20%",
      bestseller: "Top Vente",
      featured: "Coup de Cœur",
      ...(options.badgeLabels ?? {}),
    };
  }

  getBadgeLabel(badgeType: string): string {
    return this.badgeLabels[badgeType] ?? "";
  }
}
