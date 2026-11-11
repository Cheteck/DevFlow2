/* AUDIT-RESET a055b8e (2026-10-13) — PERTE CONFIRMÉE PUIS RESTAURÉE (V1.1, voir git log).
 * Transitions PendingPayment absentes du commit ; restaurées ci-dessous (PAY → PendingPayment,
 * CONFIRM → Paid, CANCEL depuis PendingPayment + tolérance legacy Pending → Paid pour les webhooks). */
import type { OrderStatus } from "./order.model.js";

export type OrderTransitionEvent =
  | "PAY"
  | "CONFIRM"
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
 * Pending -> PendingPayment -> Paid -> Processing -> Shipped -> Delivered
 * (PAY authorizes the hold, CONFIRM captures it via payment webhook)
 * Cancellations allowed from Pending, PendingPayment, Paid, Processing
 * Refunds allowed from Paid, Shipped, Delivered
 */
export class OrderStateMachine {
  private static readonly TRANSITIONS: Record<OrderStatus, Partial<Record<OrderTransitionEvent, OrderStatus>>> = {
    Pending: {
      PAY: "PendingPayment",
      CANCEL: "Cancelled",
    },
    PendingPayment: {
      CONFIRM: "Paid",
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

  /** Direct edge check current → target (used by setOrderStatus/webhooks). */
  static allowsTransition(from: OrderStatus, to: OrderStatus): boolean {
    if (from === to) return true;
    const edges = this.TRANSITIONS[from] ?? {};
    if (Object.values(edges).includes(to)) return true;
    return this.LEGACY_EDGES.some(([legacyFrom, legacyTo]) => legacyFrom === from && legacyTo === to);
  }

  /**
   * Pre-PendingPayment orders settled straight to Paid: webhooks confirming
   * those legacy orders must keep working (see commerce-controller.handleWebhook).
   */
  private static readonly LEGACY_EDGES: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
    ["Pending", "Paid"],
  ];

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
