/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/**
 * @apps/commerce — Order Model with Traits & ORM
 */

import { Model, applyTraits, SoftDeleteTrait, TimestampableTrait } from "@mosaix/sdk";
import type { SellerEntityRef } from "./commerce-offer.model.js";

/* AUDIT-RESET a055b8e (2026-10-13) — PERTE CONFIRMÉE PUIS RESTAURÉE (V1.1, voir git log).
 * "PendingPayment" était annoncé par la session puis absent du commit ; `git log -S PendingPayment`
 * vide sur tout l'historique. Restauré ici dans l'union + migration du CHECK (migrations.ts +
 * 20261013000000_order_pending_payment) ; tester la machine avant toute évolution. */

export type OrderStatus =
  | "Pending"
  | "PendingPayment"
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

