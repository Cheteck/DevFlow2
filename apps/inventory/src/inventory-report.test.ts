import { describe, expect, it } from "vitest";
import {
  InventoryReportService,
  type StockSource,
} from "./domain/inventory-report.service.js";

const source: StockSource = {
  listLevels: async () => [
    { sku: "SKU-EMPTY", onHand: 0, reorderPoint: 5 },
    { sku: "SKU-LOW", onHand: 2, reorderPoint: 5 },
    { sku: "SKU-OK", onHand: 50, reorderPoint: 5 },
  ],
};

describe("@apps/inventory report (quantities only, no pricing)", () => {
  it("tracks out-of-stock visits and restock subscriptions by sku", () => {
    const service = new InventoryReportService();
    service.recordOutOfStockVisit("SKU-EMPTY", "visitor_1", "space_1");
    const sub = service.registerRestockAlertSubscription("SKU-EMPTY", "buyer@interest.com", "space_1");

    expect(sub.id).toBeDefined();
    expect(sub.notified).toBe(false);
    expect(service.getMissedDemandForSku("SKU-EMPTY")).toEqual({ visitsCount: 1, subscribersCount: 1 });
  });

  it("rejects invalid contact emails", () => {
    const service = new InventoryReportService();
    expect(() => service.registerRestockAlertSubscription("SKU-EMPTY", "not-an-email")).toThrow();
  });

  it("generates a quantity-only report without monetary valuation", async () => {
    const service = new InventoryReportService();
    const report = await service.generateReport(source, "space_1");

    expect(report.positionsCount).toBe(3);
    expect(report.outOfStockCount).toBe(1);
    expect(report.criticalLowCount).toBe(1);
    expect(report.alerts).toHaveLength(2);
    expect(report).not.toHaveProperty("totalInventoryValuation");
    expect(report).not.toHaveProperty("estimatedMissedRevenue");
    expect(report.alerts[0]).not.toHaveProperty("basePrice");
  });
});
