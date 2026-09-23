/**
 * @mosaix-plugin/commerce-badge — Product Badge Plugin
 */

export class BadgePlugin {
  getBadgeLabel(badgeType: string): string {
    if (badgeType === "new") return "Nouveau";
    if (badgeType === "promo") return "Promo -20%";
    return "";
  }
}
