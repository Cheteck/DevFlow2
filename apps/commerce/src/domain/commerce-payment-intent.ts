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
