import { describe, expect, it } from "vitest";
import * as crypto from "node:crypto";
import type { HttpRequest } from "@mosaix/sdk";
import { OrderService } from "./domain/order.service.js";
import { SatimPaymentPort } from "./domain/satim-payment-port.js";
import { OrderModel } from "./domain/order.model.js";
import { CommerceController } from "./infrastructure/commerce-controller.js";
import { DemoPaymentPort, DemoInventoryPort } from "./workflows/checkout-order.workflow.js";
import { InMemoryOrderRepository } from "./infrastructure/postgres-order-repository.js";

/**
 * V3.1 (BOUND-02): payment webhooks settle orders ONLY on verified HMAC.
 * Unsigned/tampered claims are rejected; missing verifier fails closed (503).
 */

const SECRET = "test-webhook-secret-32-chars-min!!";

function sign(payload: unknown): string {
  return `sha256=${crypto.createHmac("sha256", SECRET).update(JSON.stringify(payload)).digest("hex")}`;
}

function req(body: unknown, signature?: string): HttpRequest {
  return {
    method: "POST",
    path: "/commerce/checkout/webhook",
    headers: signature ? { "x-satim-signature": signature } : {},
    body,
  } as unknown as HttpRequest;
}

async function pendingOrder() {
  const repository = new InMemoryOrderRepository();
  const service = new OrderService(repository, new DemoPaymentPort(), new DemoInventoryPort());
  const { order } = await service.createOrder({ userId: "usr-wh", vendableId: "vend-wh", amount: 20 });
  return { service, repository, order };
}

describe("SATIM webhook verification (fail-closed)", () => {
  it("settles PendingPayment to Paid on a valid signature", async () => {
    const { service } = await pendingOrder();
    const controller = new CommerceController(service, new SatimPaymentPort({ webhookSecret: SECRET }));

    const { order } = await service.createOrder({ userId: "u", vendableId: "v", amount: 5 });
    const body = { type: "payment_intent.succeeded", orderId: order.id };
    const res = await controller.handleWebhook(req(body, sign(body)));

    expect(res.statusCode).toBe(200);
    expect((await service.getOrderById(order.id)).status).toBe("Paid");
  });

  it("rejects tampered bodies and wrong secrets (401), order untouched", async () => {
    const { service, order } = await pendingOrder();
    const controller = new CommerceController(service, new SatimPaymentPort({ webhookSecret: SECRET }));

    const goodBody = { type: "payment_intent.succeeded", orderId: order.id };
    const tampered = { type: "payment_intent.succeeded", orderId: order.id, amount: 999999 };
    const resTampered = await controller.handleWebhook(req(tampered, sign(goodBody)));
    expect(resTampered.statusCode).toBe(401);

    const wrongSecret = new CommerceController(
      service,
      new SatimPaymentPort({ webhookSecret: "another-secret-0000000000000000" }),
    );
    const resWrong = await wrongSecret.handleWebhook(req(goodBody, sign(goodBody)));
    expect(resWrong.statusCode).toBe(401);

    const resMissing = await controller.handleWebhook(req(goodBody));
    expect(resMissing.statusCode).toBe(401);

    expect((await service.getOrderById(order.id)).status).toBe("PendingPayment");
  });

  it("fails closed without a verifier (503) and keeps legacy Pending webhooks working", async () => {
    const { service, repository } = await pendingOrder();
    const unwired = new CommerceController(service);
    const body = { type: "payment_intent.succeeded", orderId: "ord-legacy" };
    const res = await unwired.handleWebhook(req(body, sign(body)));
    expect(res.statusCode).toBe(503);

    // Legacy order settled straight to Paid before PendingPayment existed.
    const legacy = new OrderModel();
    legacy.id = "ord-legacy";
    legacy.userId = "usr-legacy";
    legacy.vendableId = "vend-legacy";
    legacy.status = "Pending";
    await repository.save(legacy);

    const wired = new CommerceController(service, new SatimPaymentPort({ webhookSecret: SECRET }));
    const resLegacy = await wired.handleWebhook(req(body, sign(body)));
    expect(resLegacy.statusCode).toBe(200);
    expect((await service.getOrderById("ord-legacy")).status).toBe("Paid");
  });

  it("never verifies without a configured secret (fail-closed primitive)", () => {
    const port = new SatimPaymentPort({ webhookSecret: "" });
    expect(port.verifyWebhook(sign({ a: 1 }), { a: 1 })).toBe(false);
    expect(port.verifyWebhook("", { a: 1 })).toBe(false);
  });
});
