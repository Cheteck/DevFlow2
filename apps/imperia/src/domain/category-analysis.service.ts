/**
 * @apps/imperia/domain — Category Market Opportunity & Under-Representation Analysis Service
 * FEAT-11: Analyse catégories [CŒUR] (imperia + spaces/portfolio)
 */

import type { PortfolioService } from "@apps/portfolio";

export interface CategoryMarketStats {
  category: string;
  totalProducts: number;
  totalActiveShops: number;
  underRepresented: boolean;
  opportunityScore: number; // 0 to 100 (100 = huge market gap / high merchant opportunity)
  demandLevel: "high" | "moderate" | "low";
  recommendations: string;
}

export interface CategoryAnalysisReport {
  generatedAt: string;
  totalCategoriesScanned: number;
  underRepresentedCategoriesCount: number;
  topOpportunities: CategoryMarketStats[];
  categoryBreakdown: CategoryMarketStats[];
}

export class CategoryAnalysisService {
  /**
   * Scans portfolio catalog and spaces distribution to identify underserved categories
   */
  async analyzeCategories(
    portfolioService?: PortfolioService,
    activeCategories = [
      "Artisanat & Création",
      "Mode & Vêtements",
      "Électronique & High-Tech",
      "Alimentation Locale & Bio",
      "Maison & Mobilier",
      "Beauté & Soins Naturels",
      "Services Professionnels",
      "Livres & Éducation",
      "Sport & Plein Air",
      "Équipements Écologiques",
    ]
  ): Promise<CategoryAnalysisReport> {
    const vendables = portfolioService ? await portfolioService.search({ limit: 2000 }) : [];
    const categoryCounts = new Map<string, { products: number; spaceIds: Set<string> }>();

    for (const cat of activeCategories) {
      categoryCounts.set(cat, { products: 0, spaceIds: new Set() });
    }

    for (const v of vendables) {
      const cats = v.classification?.categories || [];
      const spaceId = (v.metadata?.spaceId as string) || "space_default";
      for (const c of cats) {
        if (!categoryCounts.has(c)) {
          categoryCounts.set(c, { products: 0, spaceIds: new Set() });
        }
        const item = categoryCounts.get(c)!;
        item.products += 1;
        item.spaceIds.add(spaceId);
      }
    }

    const breakdown: CategoryMarketStats[] = [];

    for (const [category, data] of categoryCounts.entries()) {
      const shopsCount = data.spaceIds.size;
      const underRepresented = shopsCount <= 1;

      // Higher opportunity score when few shops exist
      let opportunityScore = 50;
      let demandLevel: "high" | "moderate" | "low" = "moderate";
      let recommendations = "Densité de marchands équilibrée.";

      if (shopsCount === 0) {
        opportunityScore = 95;
        demandLevel = "high";
        recommendations = "Priorité d'acquisition marchands : Aucun vendeur actif dans cette catégorie.";
      } else if (shopsCount === 1) {
        opportunityScore = 80;
        demandLevel = "high";
        recommendations = "Marché quasi-monopolistique ou sous-exploité. Inviter de nouveaux créateurs.";
      } else if (shopsCount > 10) {
        opportunityScore = 30;
        demandLevel = "low";
        recommendations = "Catégorie bien pourvue. Favoriser la différenciation produit.";
      }

      breakdown.push({
        category,
        totalProducts: data.products,
        totalActiveShops: shopsCount,
        underRepresented,
        opportunityScore,
        demandLevel,
        recommendations,
      });
    }

    breakdown.sort((a, b) => b.opportunityScore - a.opportunityScore);

    const underRepresentedCount = breakdown.filter((b) => b.underRepresented).length;

    return {
      generatedAt: new Date().toISOString(),
      totalCategoriesScanned: breakdown.length,
      underRepresentedCategoriesCount: underRepresentedCount,
      topOpportunities: breakdown.slice(0, 5),
      categoryBreakdown: breakdown,
    };
  }
}

export const categoryAnalysisService = new CategoryAnalysisService();
