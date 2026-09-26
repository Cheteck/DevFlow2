import * as crypto from "node:crypto";
/**
 * @apps/portfolio/domain — Shop Inventory Reports & Out-Of-Stock Demand Intelligence
 * FEAT-06: Rapports boutiques [CŒUR + plugin rendu] (portfolio + commerce)
 * FEAT-07: Intérêt produits en rupture [CŒUR] (portfolio + telemetry)
 */

import type { PortfolioService } from "./portfolio-service.js";

export interface StockAlertItem {
  vendableId: string;
  reference: string;
  name: string;
  currentStock: number;
  reorderPoint: number;
  status: "out_of_stock" | "critical_low" | "reorder_recommended";
  basePrice: number;
  currency: string;
  recommendedRestockQuantity: number;
  missedDemandCount: number;
  alertSubscribersCount: number;
}

export interface ShopInventoryReport {
  spaceId?: string;
  generatedAt: string;
  totalVendablesCount: number;
  outOfStockCount: number;
  criticalLowCount: number;
  reorderRecommendedCount: number;
  totalInventoryValuation: number;
  estimatedMissedRevenue: number;
  alerts: StockAlertItem[];
}

export interface OutOfStockInterestRecord {
  vendableId: string;
  spaceId?: string;
  visitorId?: string;
  timestamp: string;
}

export interface RestockAlertSubscription {
  id: string;
  vendableId: string;
  spaceId?: string;
  contactEmail: string;
  subscribedAt: string;
  notified: boolean;
}

export class ShopInventoryReportService {
  private outOfStockVisits: OutOfStockInterestRecord[] = [];
  private alertSubscriptions = new Map<string, RestockAlertSubscription[]>();

  /**
   * FEAT-07: Record a visit on an out-of-stock product
   */
  recordOutOfStockVisit(vendableId: string, visitorId?: string, spaceId?: string): void {
    this.outOfStockVisits.push({
      vendableId,
      spaceId,
      visitorId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * FEAT-07: Subscribe to restock notification
   */
  registerRestockAlertSubscription(vendableId: string, contactEmail: string, spaceId?: string): RestockAlertSubscription {
    const email = contactEmail.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Adresse email invalide pour l'alerte réapprovisionnement.");
    }

    const id = `sub_${crypto.randomUUID()}`;
    const sub: RestockAlertSubscription = {
      id,
      vendableId,
      spaceId,
      contactEmail: email,
      subscribedAt: new Date().toISOString(),
      notified: false,
    };

    if (!this.alertSubscriptions.has(vendableId)) {
      this.alertSubscriptions.set(vendableId, []);
    }
    this.alertSubscriptions.get(vendableId)!.push(sub);
    return sub;
  }

  getMissedDemandForVendable(vendableId: string): { visitsCount: number; subscribersCount: number } {
    const visits = this.outOfStockVisits.filter((v) => v.vendableId === vendableId).length;
    const subs = (this.alertSubscriptions.get(vendableId) ?? []).length;
    return { visitsCount: visits, subscribersCount: subs };
  }

  /**
   * FEAT-06: Compute comprehensive shop inventory health & replenishment report
   */
  async generateReport(portfolioService: PortfolioService, spaceId?: string): Promise<ShopInventoryReport> {
    const vendables = await portfolioService.search({ limit: 1000 });
    const filtered = spaceId
      ? vendables.filter((v) => v.characteristics.attributes?.spaceId === spaceId)
      : vendables;

    const alerts: StockAlertItem[] = [];
    let outOfStockCount = 0;
    let criticalLowCount = 0;
    let reorderRecommendedCount = 0;
    let totalInventoryValuation = 0;
    let estimatedMissedRevenue = 0;

    for (const v of filtered) {
      const stock = v.inventory?.stock ?? 0;
      const reorderPoint = v.inventory?.reorderPoint ?? 5;
      const basePrice = v.pricing?.basePrice ?? 0;
      const currency = v.pricing?.currency ?? "EUR";
      const name = Object.values(v.content)[0]?.name || v.identity.reference;

      totalInventoryValuation += stock * basePrice;

      const demand = this.getMissedDemandForVendable(v.identity.id);

      let status: "out_of_stock" | "critical_low" | "reorder_recommended" | null = null;
      if (stock === 0) {
        status = "out_of_stock";
        outOfStockCount += 1;
        estimatedMissedRevenue += (demand.visitsCount + demand.subscribersCount) * basePrice;
      } else if (stock <= 3) {
        status = "critical_low";
        criticalLowCount += 1;
      } else if (stock <= reorderPoint) {
        status = "reorder_recommended";
        reorderRecommendedCount += 1;
      }

      if (status) {
        alerts.push({
          vendableId: v.identity.id,
          reference: v.identity.reference,
          name,
          currentStock: stock,
          reorderPoint,
          status,
          basePrice,
          currency,
          recommendedRestockQuantity: Math.max(10, (reorderPoint * 2) - stock),
          missedDemandCount: demand.visitsCount,
          alertSubscribersCount: demand.subscribersCount,
        });
      }
    }

    return {
      spaceId,
      generatedAt: new Date().toISOString(),
      totalVendablesCount: filtered.length,
      outOfStockCount,
      criticalLowCount,
      reorderRecommendedCount,
      totalInventoryValuation,
      estimatedMissedRevenue,
      alerts,
    };
  }
}

export const shopInventoryReportService = new ShopInventoryReportService();
