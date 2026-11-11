import type { Container, Router, RuntimeKernel, TenantIdentity } from "@mosaix/sdk";
import {
  InventoryReportService,
  inventoryReportService,
} from "./domain/inventory-report.service.js";

export const MANIFEST = {
  id: "@apps/inventory",
  name: "Inventory & Stock Levels",
  version: "0.1.0",
  capabilities: [
    { id: "inventory.stock.report", version: "1.0.0" },
    { id: "inventory.restock.subscribe", version: "1.0.0" },
  ],
  permissions: ["inventory:stock:read:tenant", "inventory:restock:subscribe"],
  events: ["inventory.stock.depleted", "inventory.restock.requested"],
};

export class InventoryServiceProvider {
  register(container: Container): void {
    container.instance(InventoryReportService, inventoryReportService);
  }

  async boot(container: Container, router: Router): Promise<unknown> {
    const service = container.resolve(InventoryReportService);
    router.get("/inventory/health", () => ({
      statusCode: 200,
      body: { status: "ok", app: MANIFEST.id },
    }));
    void service;
    return { manifest: MANIFEST, status: "active" };
  }
}

export function createInventoryApp(kernel: RuntimeKernel, tenant: TenantIdentity): unknown {
  void kernel;
  void tenant;
  return { manifest: MANIFEST };
}

export * from "./domain/inventory-report.service.js";
