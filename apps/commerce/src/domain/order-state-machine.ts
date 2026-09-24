import type { OrderStatus } from "./order.model.js";

export type OrderTransitionEvent =
  | "PAY"
  | "PROCESS"
  | "SHIP"
  | "DELIVER"
  | "CANCEL"
  | "REFUND";

export interface StateTransitionResult {
  success: boolean;
  from: OrderStatus;
  to: OrderStatus;
  error?: string;
}

/**
 * Order State Machine
 * Deterministic transition rules for Commerce orders:
 * Pending -> Paid -> Processing -> Shipped -> Delivered
 * Cancellations allowed from Pending, Paid, Processing
 * Refunds allowed from Paid, Shipped, Delivered
 */
export class OrderStateMachine {
  private static readonly TRANSITIONS: Record<OrderStatus, Partial<Record<OrderTransitionEvent, OrderStatus>>> = {
    Pending: {
      PAY: "Paid",
      CANCEL: "Cancelled",
    },
    Paid: {
      PROCESS: "Processing",
      CANCEL: "Cancelled",
      REFUND: "Refunded",
    },
    Processing: {
      SHIP: "Shipped",
      CANCEL: "Cancelled",
      REFUND: "Refunded",
    },
    Shipped: {
      DELIVER: "Delivered",
      REFUND: "Refunded",
    },
    Delivered: {
      REFUND: "Refunded",
    },
    Cancelled: {},
    Refunded: {},
  };

  static getNextState(current: OrderStatus, event: OrderTransitionEvent): OrderStatus | null {
    return this.TRANSITIONS[current]?.[event] ?? null;
  }

  static can(current: OrderStatus, event: OrderTransitionEvent): boolean {
    return this.getNextState(current, event) !== null;
  }

  static transition(current: OrderStatus, event: OrderTransitionEvent): StateTransitionResult {
    const next = this.getNextState(current, event);
    if (!next) {
      return {
        success: false,
        from: current,
        to: current,
        error: `Transition interdite: impossible d'exécuter '${event}' depuis l'état '${current}'.`,
      };
    }
    return {
      success: true,
      from: current,
      to: next,
    };
  }
}
