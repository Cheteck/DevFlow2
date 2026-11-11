import { describe, it, expect, vi } from "vitest";
import {
  dispatchPspEvent,
  registerPspEventHandler,
} from "./psp-webhook-handler.js";

describe("dispatchPspEvent (OCP registry)", () => {
  it("publishes commerce.order.paid on payment_intent.succeeded", () => {
    const publish = vi.fn();
    const backplane = { publish };
    dispatchPspEvent(
      {
        id: "1",
        type: "payment_intent.succeeded",
        data: { orderId: "o1", amountInCents: 100, currency: "EUR" },
        created: 123,
      },
      backplane,
    );
    expect(publish).toHaveBeenCalledWith("commerce.order.paid", {
      orderId: "o1",
      amountInCents: 100,
      currency: "EUR",
      timestamp: 123,
    });
  });

  it("publishes subscription.user.updated on invoice.paid", () => {
    const publish = vi.fn();
    const backplane = { publish };
    dispatchPspEvent(
      {
        id: "2",
        type: "invoice.paid",
        data: { userId: "u1", planId: "p1" },
        created: 456,
      },
      backplane,
    );
    expect(publish).toHaveBeenCalledWith("subscription.user.updated", {
      userId: "u1",
      planId: "p1",
      status: "active",
      timestamp: 456,
    });
  });

  it("publishes subscription.user.cancelled on customer.subscription.deleted", () => {
    const publish = vi.fn();
    const backplane = { publish };
    dispatchPspEvent(
      {
        id: "3",
        type: "customer.subscription.deleted",
        data: { userId: "u2", planId: "p2" },
        created: 789,
      },
      backplane,
    );
    expect(publish).toHaveBeenCalledWith("subscription.user.cancelled", {
      userId: "u2",
      planId: "p2",
      status: "canceled",
      timestamp: 789,
    });
  });

  it("allows registering a new event type without modifying dispatchPspEvent", () => {
    const publish = vi.fn();
    registerPspEventHandler("charge.refunded", (event, bp) => {
      bp.publish("commerce.order.refunded", { orderId: event.data.orderId });
    });
    const backplane = { publish };
    dispatchPspEvent(
      {
        id: "4",
        type: "charge.refunded" as unknown as "payment_intent.succeeded",
        data: { orderId: "o9" },
        created: 1,
      },
      backplane,
    );
    expect(publish).toHaveBeenCalledWith("commerce.order.refunded", {
      orderId: "o9",
    });
  });
});
