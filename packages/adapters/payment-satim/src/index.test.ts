import { describe, it, expect } from "vitest";
import { SatimPaymentAdapter } from "./index.js";
import * as crypto from "node:crypto";

describe("SatimPaymentAdapter Specification Suite", () => {
  it("registers an order in simulation mode and generates redirect URL", async () => {
    const adapter = new SatimPaymentAdapter({ isLiveMode: false });

    const result = await adapter.registerOrder({
      orderId: "ord_satim_test_100",
      amountInCents: 150000, // 1,500.00 DZD
    });

    expect(result.success).toBe(true);
    expect(result.satimOrderId).toBeDefined();
    expect(result.formUrl).toContain("redirect.do");
    expect(result.formUrl).toContain("ord_satim_test_100");
  });

  it("checks order status in simulation mode", async () => {
    const adapter = new SatimPaymentAdapter({ isLiveMode: false });

    const status = await adapter.getOrderStatus("satim_12345");
    expect(status.success).toBe(true);
    expect(status.orderStatus).toBe("APPROVED");
  });

  it("verifies webhook HMAC-SHA256 signature correctly", () => {
    const secret = "mosaix_satim_test_secret_123";
    const adapter = new SatimPaymentAdapter({ webhookSecret: secret });

    const payload = JSON.stringify({ orderId: "ord_100", status: "APPROVED" });
    const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    expect(adapter.verifyWebhookSignature(payload, validSignature)).toBe(true);
    expect(adapter.verifyWebhookSignature(payload, "invalid_signature")).toBe(false);
  });
});
