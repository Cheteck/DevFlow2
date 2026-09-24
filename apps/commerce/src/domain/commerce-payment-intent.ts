export type PaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "processing"
  | "succeeded"
  | "canceled"
  | "partially_refunded"
  | "refunded";

export interface PaymentIntent {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  clientSecret?: string;
  amountReceived: number;
  amountRefunded: number;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequest {
  paymentIntentId: string;
  amount: number;
  reason?: string;
}

export interface InventoryReservationEventPayload {
  orderId: string;
  items: Array<{ sku: string; quantity: number }>;
  expiresAt: string;
}

export interface InventoryCompensationEventPayload {
  orderId: string;
  items: Array<{ sku: string; quantity: number }>;
  reason: string;
}

export class PaymentRefundManager {
  static processRefund(intent: PaymentIntent, request: RefundRequest): {
    success: boolean;
    updatedIntent: PaymentIntent;
    refundedAmount: number;
  } {
    if (intent.status !== "succeeded" && intent.status !== "partially_refunded") {
      throw new Error(`Cannot refund payment intent in status [${intent.status}].`);
    }

    const maxRefundable = intent.amountReceived - intent.amountRefunded;
    if (request.amount <= 0 || request.amount > maxRefundable) {
      throw new Error(`Refund amount [${request.amount}] exceeds max refundable [${maxRefundable}].`);
    }

    intent.amountRefunded += request.amount;
    intent.status = intent.amountRefunded >= intent.amountReceived ? "refunded" : "partially_refunded";
    intent.updatedAt = new Date().toISOString();

    return {
      success: true,
      updatedIntent: intent,
      refundedAmount: request.amount,
    };
  }
}

export interface StockReservationPort {
  reserve(sku: string, qty: number): Promise<boolean>;
  release(sku: string, qty: number): Promise<void>;
}

export class InventoryReservationSaga {
  static async execute(
    orderId: string,
    items: Array<{ sku: string; quantity: number }>,
    stockPort: StockReservationPort
  ): Promise<{ success: boolean; error?: string }> {
    const reservedItems: Array<{ sku: string; quantity: number }> = [];

    for (const item of items) {
      const ok = await stockPort.reserve(item.sku, item.quantity);
      if (!ok) {
        // Compensating saga rollback for already reserved items
        for (const reserved of reservedItems) {
          await stockPort.release(reserved.sku, reserved.quantity);
        }
        return {
          success: false,
          error: `Insufficient stock for SKU [${item.sku}]. Saga compensation completed.`,
        };
      }
      reservedItems.push(item);
    }

    return { success: true };
  }
}

