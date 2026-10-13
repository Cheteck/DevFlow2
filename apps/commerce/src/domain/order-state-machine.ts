/* AUDIT-RESET a055b8e (2026-10-13) — PERTE CONFIRMÉE.
 * La session annonçait "OrderStatus PendingPayment et OrderStateMachine transitions mis à jour",
 * et le message du commit a055b8e le revendique, mais ce fichier est ABSENT du commit et ne contient
 * aucune transition PendingPayment. `git log -S PendingPayment` est vide sur tout l'historique : le travail
 * a été réinitialisé avant le commit sans laisser de trace versionnée.
 * Restauration recommandée : réintroduire l'état PendingPayment + ses transitions (PAY depuis PendingPayment,
 * CANCEL/REFUND selon la saga checkout) puis valider par les tests Commerce (can/allowsTransition/transition).
 * Ne pas se fier au message de a055b8e comme preuve de l'état antérieur. */
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

  /** Direct edge check current → target (used by setOrderStatus/webhooks). */
  static allowsTransition(from: OrderStatus, to: OrderStatus): boolean {
    if (from === to) return true;
    const edges = this.TRANSITIONS[from] ?? {};
    return Object.values(edges).includes(to);
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
