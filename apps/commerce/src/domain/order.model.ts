/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/**
 * @apps/commerce — Order Model with Traits & ORM
 */

import { Model, applyTraits, SoftDeleteTrait, TimestampableTrait } from "@mosaix/sdk";
import type { SellerEntityRef } from "./commerce-offer.model.js";

/* AUDIT-RESET a055b8e (2026-10-13) — PERTE CONFIRMÉE.
 * La session annonçait l'ajout du statut "PendingPayment" à OrderStatus et le message de a055b8e le
 * revendique, mais l'union ci-dessous (Pending..Refunded) ne le contient pas et `git log -S PendingPayment`
 * est vide sur tout l'historique : réinitialisation avant commit, sans trace versionnée.
 * Restauration recommandée : réintroduire "PendingPayment" dans l'union + migration partielle UNIQUE
 * éventuelle, aligner order-state-machine.ts et checkout-order.workflow.ts, puis tests Commerce verts. */

export type OrderStatus =
  | "Pending"
  | "Paid"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "Refunded";

export interface OrderAddress {
  fullName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface OrderLineItem {
  id: string;
  sku: string;
  vendableId: string;
  offerId?: string;
  seller?: SellerEntityRef;
  title: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}


export class OrderModel extends Model {
  static override tableName = "commerce_orders";

  userId!: string;
  vendableId!: string;
  status!: OrderStatus;
  currency: string = "EUR";
  totalAmount: number = 0;
  taxAmount: number = 0;
  discountCode?: string;
  /** Double-submit protection (partial UNIQUE in DB, enforced in OrderService). */
  idempotencyKey?: string;
  shippingAddress?: OrderAddress;
  billingAddress?: OrderAddress;
  lineItems: OrderLineItem[] = [];
}

export interface OrderModel extends TimestampableTrait, SoftDeleteTrait {}
applyTraits(OrderModel, [TimestampableTrait, SoftDeleteTrait]);

