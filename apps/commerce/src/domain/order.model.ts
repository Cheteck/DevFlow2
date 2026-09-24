/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/**
 * @apps/commerce — Order Model with Traits & ORM
 */

import { Model, applyTraits, SoftDeleteTrait, TimestampableTrait } from "@mosaix/sdk";
import type { SellerEntityRef } from "./commerce-offer.model.js";

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
  static override tableName = "orders";

  userId!: string;
  vendableId!: string;
  status!: OrderStatus;
  currency: string = "EUR";
  totalAmount: number = 0;
  taxAmount: number = 0;
  discountCode?: string;
  shippingAddress?: OrderAddress;
  billingAddress?: OrderAddress;
  lineItems: OrderLineItem[] = [];
}

export interface OrderModel extends TimestampableTrait, SoftDeleteTrait {}
applyTraits(OrderModel, [TimestampableTrait, SoftDeleteTrait]);

