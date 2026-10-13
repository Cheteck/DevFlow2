import { Controller, type HttpRequest, type HttpResponse } from "@mosaix/sdk";
import { OrderService } from "../domain/order.service.js";
import { CommerceDomainError, OrderValidationError, OrderNotFoundError } from "../domain/commerce.errors.js";
import type { SatimPaymentPort } from "../domain/satim-payment-port.js";

export class CommerceController extends Controller {
  constructor(
    private readonly orderService: OrderService,
    private readonly webhookVerifier?: Pick<SatimPaymentPort, "verifyWebhook">,
  ) {
    super();
  }

  async createOrder(req: HttpRequest): Promise<HttpResponse> {
    try {
      const body = req.body as { userId?: string; vendableId?: string; amount?: number } | undefined;
      if (!body?.userId || !body?.vendableId) {
        return this.badRequest("userId and vendableId are required.");
      }

      const result = await this.orderService.createOrder({
        userId: body.userId,
        vendableId: body.vendableId,
        amount: body.amount,
      });
      return this.created({
        id: result.order.id,
        userId: result.order.userId,
        vendableId: result.order.vendableId,
        status: result.order.status,
        createdAt: result.order.createdAt,
      });
    } catch (error) {
      if (error instanceof OrderValidationError || error instanceof CommerceDomainError) {
        return this.json({ error: (error as Error).message }, 400);
      }
      return this.json({ error: "Internal server error" }, 500);
    }
  }

  async getOrder(req: HttpRequest): Promise<HttpResponse> {
    try {
      const orderId = req.params?.id as string | undefined;
      if (!orderId) {
        return this.badRequest("Order ID param is required");
      }
      const order = await this.orderService.getOrderById(orderId);
      return this.json({
        id: order.id,
        userId: order.userId,
        vendableId: order.vendableId,
        status: order.status,
        createdAt: order.createdAt,
      });
    } catch (error) {
      if (error instanceof OrderNotFoundError) {
        return this.json({ error: error.message, code: "ORDER_NOT_FOUND" }, 404);
      }
      return this.json({ error: "Internal server error" }, 500);
    }
  }

  async listOrders(_req?: HttpRequest): Promise<HttpResponse> {
    const orders = await this.orderService.listOrders();
    return this.json(
      orders.map((o) => ({
        id: o.id,
        userId: o.userId,
        vendableId: o.vendableId,
        status: o.status,
        createdAt: o.createdAt,
      }))
    );
  }

  async handleWebhook(req: HttpRequest): Promise<HttpResponse> {
    try {
      const body = req.body as { type?: string; orderId?: string; status?: string; signature?: string } | undefined;
      if (!body?.type || !body?.orderId) {
        return this.badRequest("Webhook body requires 'type' and 'orderId'.");
      }

      if (body.type === "payment_intent.succeeded" || body.type === "checkout.session.completed") {
        // V3.1 (BOUND-02): never settle on an unsigned claim. Signature travels in
        // `x-satim-signature` (fallback: body.signature for PSP variants).
        if (!this.webhookVerifier) {
          return this.json({ error: "Webhook verifier not wired." }, 503);
        }
        const signature = req.headers?.["x-satim-signature"] ?? body.signature ?? "";
        if (!this.webhookVerifier.verifyWebhook(signature, body)) {
          return this.json({ error: "Invalid webhook signature." }, 401);
        }
        const order = await this.orderService.getOrderById(body.orderId);
        if (order) {
          await this.orderService.setOrderStatus(String(order.id), "Paid");
        }
        return this.json({ received: true, orderId: body.orderId, status: "Paid" }, 200);
      }

      return this.json({ received: true, status: "ignored" }, 200);
    } catch (_error) {
      return this.json({ error: "Webhook processing failed" }, 500);
    }
  }
}
