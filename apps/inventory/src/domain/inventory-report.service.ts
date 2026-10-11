import * as crypto from "node:crypto";

/**
 * @apps/inventory/domain — Stock levels, out-of-stock demand signals & restock subscriptions.
 * Extracted from `@apps/portfolio` (PIM purity) : quantities only, no pricing.
 * Monetary valuation belongs to Commerce/Billing, which own prices.
 */

/** A stock position supplied by the owning system (warehouse, Space, seller). */
export interface StockLevel {
  sku: string;
  reference?: string;
  label?: string;
  spaceId?: string;
  onHand: number;
  reorderPoint: number;
}

/** Source of stock positions. Implemented by whoever holds physical stock. */
export interface StockSource {
  listLevels(spaceId?: string): Promise<StockLevel[]>;
}

export interface StockAlertItem {
  sku: string;
  reference: string;
  label: string;
  onHand: number;
  reorderPoint: number;
  status: "out_of_stock" | "critical_low" | "reorder_recommended";
  recommendedRestockQuantity: number;
  missedDemandCount: number;
  alertSubscribersCount: number;
}

export interface InventoryReport {
  spaceId?: string;
  generatedAt: string;
  positionsCount: number;
  outOfStockCount: number;
  criticalLowCount: number;
  reorderRecommendedCount: number;
  alerts: StockAlertItem[];
}

export interface OutOfStockInterestRecord {
  sku: string;
  spaceId?: string;
  visitorId?: string;
  timestamp: string;
}

export interface RestockAlertSubscription {
  id: string;
  sku: string;
  spaceId?: string;
  contactEmail: string;
  subscribedAt: string;
  notified: boolean;
}

export class InventoryReportService {
  private outOfStockVisits: OutOfStockInterestRecord[] = [];
  private alertSubscriptions = new Map<string, RestockAlertSubscription[]>();

  recordOutOfStockVisit(sku: string, visitorId?: string, spaceId?: string): void {
    this.outOfStockVisits.push({
      sku,
      spaceId,
      visitorId,
      timestamp: new Date().toISOString(),
    });
  }

  registerRestockAlertSubscription(
    sku: string,
    contactEmail: string,
    spaceId?: string,
  ): RestockAlertSubscription {
    const email = contactEmail.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Adresse email invalide pour l'alerte réapprovisionnement.");
    }

    const id = `sub_${crypto.randomUUID()}`;
    const sub: RestockAlertSubscription = {
      id,
      sku,
      spaceId,
      contactEmail: email,
      subscribedAt: new Date().toISOString(),
      notified: false,
    };

    if (!this.alertSubscriptions.has(sku)) {
      this.alertSubscriptions.set(sku, []);
    }
    this.alertSubscriptions.get(sku)!.push(sub);
    return sub;
  }

  getMissedDemandForSku(sku: string): { visitsCount: number; subscribersCount: number } {
    const visits = this.outOfStockVisits.filter((v) => v.sku === sku).length;
    const subs = (this.alertSubscriptions.get(sku) ?? []).length;
    return { visitsCount: visits, subscribersCount: subs };
  }

  async generateReport(source: StockSource, spaceId?: string): Promise<InventoryReport> {
    const levels = await source.listLevels(spaceId);

    const alerts: StockAlertItem[] = [];
    let outOfStockCount = 0;
    let criticalLowCount = 0;
    let reorderRecommendedCount = 0;

    for (const level of levels) {
      const demand = this.getMissedDemandForSku(level.sku);

      let status: StockAlertItem["status"] | null = null;
      if (level.onHand === 0) {
        status = "out_of_stock";
        outOfStockCount += 1;
      } else if (level.onHand <= 3) {
        status = "critical_low";
        criticalLowCount += 1;
      } else if (level.onHand <= level.reorderPoint) {
        status = "reorder_recommended";
        reorderRecommendedCount += 1;
      }

      if (status) {
        alerts.push({
          sku: level.sku,
          reference: level.reference ?? level.sku,
          label: level.label ?? level.sku,
          onHand: level.onHand,
          reorderPoint: level.reorderPoint,
          status,
          recommendedRestockQuantity: Math.max(10, level.reorderPoint * 2 - level.onHand),
          missedDemandCount: demand.visitsCount,
          alertSubscribersCount: demand.subscribersCount,
        });
      }
    }

    return {
      spaceId,
      generatedAt: new Date().toISOString(),
      positionsCount: levels.length,
      outOfStockCount,
      criticalLowCount,
      reorderRecommendedCount,
      alerts,
    };
  }
}

export const inventoryReportService = new InventoryReportService();
