import { describe, it, expect } from "vitest";
import { ChargilyPaymentAdapter } from "./index.js";
import * as crypto from "node:crypto";

describe("ChargilyPaymentAdapter Specification Suite", () => {
  it("creates a checkout session in simulation mode", async () => {
    const adapter = new ChargilyPaymentAdapter({ isLiveMode: false });

    const result = await adapter.createCheckoutSession({
      amountInCents: 250000, // 2,500.00 DZD
      orderId: "ord_chargily_test_200",
      successUrl: "https://mosaix.platform/success",
    });

    expect(result.success).toBe(true);
    expect(result.checkoutId).toBeDefined();
    expect(result.checkoutUrl).toContain("redirect/checkout");
  });

  it("retrieves checkout session status in simulation mode", async () => {
    const adapter = new ChargilyPaymentAdapter({ isLiveMode: false });

    const session = await adapter.getCheckoutSession("ch_session_123");
    expect(session).not.toBeNull();
    expect(session?.status).toBe("paid");
  });

  it("verifies x-chargily-signature HMAC-SHA256 signature correctly", () => {
    const secretKey = "mosaix_chargily_secret_key_999";
    const adapter = new ChargilyPaymentAdapter({ secretKey });

    const payload = JSON.stringify({ id: "ch_session_999", status: "paid" });
    const validSignature = crypto.createHmac("sha256", secretKey).update(payload).digest("hex");

    expect(adapter.verifyWebhookSignature(payload, validSignature)).toBe(true);
    expect(adapter.verifyWebhookSignature(payload, "invalid_signature")).toBe(false);
  });
});
